#include "easyinvite.hpp"

// === Paid Invite Transfer === //
// --- Registers memo account, banks half, and forwards the other half --- //

void easyinvite::on_transfer(name from, name to, asset quantity, string memo) {
  if (from == get_self() || to != get_self()) return;

  config_table conf(get_self(), get_self().value);
  auto cfg = conf.get_or_default();
  const symbol invite_symbol = cfg.min_invite_amount.symbol;
  const asset zero_invite = asset(0, invite_symbol);

  check(get_first_receiver() == cfg.token_contract, "❇️ Only configured invite token issuer is accepted");
  check(quantity.symbol == invite_symbol, "❇️ Only EASY (mon3y) is accepted");
  check(quantity.amount > 0, "Invite transfer must be positive");
  if (from == cfg.inbank_account) return;
  if (from == "hands.mon3y"_n) { easyinvite::claimreward(); return; }

  check(memo.find('|') != string::npos, "❇️ Invite memo must contain '|' as account|Welcome Message");

  check(cfg.enabled, "❇️ Sorry, registration is paused right now");
  check(cfg.min_invite_amount.amount > 0, "Configured minimum invite amount must be positive");
  check(quantity >= cfg.min_invite_amount, "Invite transfer is below configured minimum");

  name invited_account;
  string forward_memo;
  bool from_queue = false;
  const string queue_prefix = "*|";
  if (memo.size() >= queue_prefix.size() && memo.compare(0, queue_prefix.size(), queue_prefix) == 0) {
    from_queue = true;
    forward_memo = memo.substr(queue_prefix.size());
  } else {
    const size_t memo_split = memo.find('|');
    check(memo_split != string::npos && memo_split > 0, "Memo must begin with the invited account");
    const string invited_name = memo.substr(0, memo_split);
    invited_account = name(invited_name);
    check(is_account(invited_account), "Invited account does not exist");
    forward_memo = memo.substr(memo_split + 1);
  }
  adopters_table adopters(get_self(), get_self().value);

  if (from_queue) {
    invite_requests_table requests(get_self(), get_self().value);
    auto by_time = requests.get_index<"bytime"_n>();
    auto oldest = by_time.begin();
    while (oldest != by_time.end() && adopters.find(oldest->account.value) != adopters.end()) {
      by_time.erase(oldest);
      oldest = by_time.begin();
    }
    check(oldest != by_time.end(), "No pending invite requests");
    invited_account = oldest->account;
  }

  check(invited_account != from, "❇️ You can't invite yourself");

  if (adopters.find(invited_account.value) != adopters.end()) {
    const int64_t min_amount = cfg.min_invite_amount.amount;
    auto invited_itr = adopters.find(invited_account.value);
    const uint32_t level = calculate_tetrahedral_position(invited_itr->score);
    const asset min_rewelcome_amount(min_amount * static_cast<int64_t>(level), invite_symbol);
    check(quantity >= min_rewelcome_amount,
      "❇️ Welcome Back (opening floodgate to " + invited_account.to_string() + "'s downstream) requires " +
        format_whole_amount(min_rewelcome_amount));
  }

  stats_table stats(get_self(), get_self().value);
  auto current_stats = stats.get_or_default();
  const uint32_t now = current_time_point().sec_since_epoch();

  auto register_adopter_if_missing = [&](name account, name invitedby) {
    auto existing = adopters.find(account.value);
    if (existing != adopters.end()) {
      return false;
    }

    // New users invited via reflections (or contract) get that account as invitedby
    adopters.emplace(get_self(), [&](auto& row) {
      row.account = account;
      row.invitedby = invitedby;
      row.lastupdated = now;
      row.score = 1;
      row.banked = zero_invite;
    });

    current_stats.total_users += 1;
    current_stats.last_registered = account;
    return true;
  };

  const bool payer_is_registered = adopters.find(from.value) != adopters.end();
  name inviter_for_chain = payer_is_registered ? from : cfg.reflections_account;

  if (adopters.find(inviter_for_chain.value) == adopters.end()) {
    register_adopter_if_missing(inviter_for_chain, get_self());
  }

  auto invited_itr = adopters.find(invited_account.value);
  const bool already_in_program = invited_itr != adopters.end();
  const bool welcomed_now = !already_in_program && register_adopter_if_missing(invited_account, inviter_for_chain);

  if (already_in_program) {
    adopters.modify(invited_itr, same_payer, [&](auto& row) {
      row.invitedby = inviter_for_chain;
      row.lastupdated = now;
    });
  }

  invite_requests_table requests(get_self(), get_self().value);
  auto pending_request = requests.find(invited_account.value);
  if (pending_request != requests.end()) {
    requests.erase(pending_request);
  }

  if (!payer_is_registered) {
    register_adopter_if_missing(from, get_self());
  }

  if (welcomed_now) {
    auto inviter_itr = adopters.find(inviter_for_chain.value);
    uint16_t current_level = 1;
    while (inviter_itr != adopters.end() && current_level <= cfg.max_invite_depth) {
      auto account_itr = inviter_itr;
      const name next_inviter = inviter_itr->invitedby;
      adopters.modify(account_itr, same_payer, [&](auto& row) {
        row.score += 1;
        row.lastupdated = now;
      });
      current_stats.total_invite_score += 1;
      if (next_inviter == name{}) break;
      inviter_itr = adopters.find(next_inviter.value);
      current_level += 1;
    }
  }

  // === FIXED: 50/50 Split (prevents token loss) ===
  int64_t half = quantity.amount / 2;
  asset banked_amount(half, quantity.symbol);
  asset forwarded_amount = quantity - banked_amount;

  auto banked_inviter_itr = adopters.find(from.value);
  check(banked_inviter_itr != adopters.end(), "Banked payer is not registered");

  adopters.modify(banked_inviter_itr, same_payer, [&](auto& row) {
    row.banked += banked_amount;
  });

  stats.set(current_stats, get_self());

  // Send banked portion to inbank
  action(
    permission_level{get_self(), "active"_n},
    cfg.token_contract,
    "transfer"_n,
    std::make_tuple(get_self(), cfg.inbank_account, banked_amount,
      from.to_string() + " welcomes " + invited_account.to_string())
  ).send();

  // Forward to new user
  action(
    permission_level{get_self(), "active"_n},
    cfg.token_contract,
    "transfer"_n,
    std::make_tuple(get_self(), invited_account, forwarded_amount, forward_memo)
  ).send();
}//END on_transfer()

// === Request Invite === //
// --- Adds an account to the paid-invite request queue --- //

void easyinvite::ask4invite(name account, name requester) {
  require_auth(requester);
  check(is_account(account), "Requested account does not exist");
  check(is_account(requester), "Requester account does not exist");

  config_table conf(get_self(), get_self().value);
  auto cfg = conf.get_or_default();
  check(cfg.enabled, "❇️ Sorry, registration is paused right now");

  adopters_table adopters(get_self(), get_self().value);
  check(adopters.find(account.value) == adopters.end(), "❇️ This account has already been welcomed");

  invite_requests_table requests(get_self(), get_self().value);
  check(requests.find(account.value) == requests.end(), "This account already has a pending invite request");

  requests.emplace(requester, [&](auto& row) {
    row.account = account;
    row.requester = requester;
    row.requested_at = current_time_point().sec_since_epoch();
  });
}//END ask4invite()

// === Clean Invite Requests === //
// --- Drops stale queue rows for accounts already welcomed --- //

void easyinvite::cleanasks() {
  adopters_table adopters(get_self(), get_self().value);
  invite_requests_table requests(get_self(), get_self().value);
  auto by_time = requests.get_index<"bytime"_n>();

  uint32_t examined = 0;
  auto itr = by_time.begin();
  while (itr != by_time.end() && examined < 12) {
    ++examined;
    if (adopters.find(itr->account.value) != adopters.end()) {
      itr = by_time.erase(itr);
    } else {
      ++itr;
    }
  }
}//END cleanasks()

string easyinvite::format_whole_amount(const asset& a) {
  int64_t unit = 1;
  for (uint8_t i = 0; i < a.symbol.precision(); i++) {
    unit *= 10;
  }
  return std::to_string(a.amount / unit) + " " + a.symbol.code().to_string();
}

// === Claim Reward === //
// --- Pays EASY rewards for a configured page of adopters --- //

void easyinvite::claimreward() {
  // - Contract status and reward pool snapshot
  config_table conf(get_self(), get_self().value);
  auto cfg = conf.get_or_default();
  const symbol invite_symbol = cfg.min_invite_amount.symbol;
  check(cfg.claim_limit > 0, "Claim limit must be positive");

  // Read live balances
  const asset inbank_balance = get_balance(cfg.token_contract, cfg.inbank_account, invite_symbol.code());
  const asset contract_balance = get_balance(cfg.token_contract, get_self(), invite_symbol.code());

  if (contract_balance.amount < 100000000) return;

  const uint64_t reward_pool_amount_u = static_cast<uint64_t>(contract_balance.amount);
  const uint64_t total_banked_amount = static_cast<uint64_t>(inbank_balance.amount);

  adopters_table adopters(get_self(), get_self().value);
  auto itr = cfg.claim_start_key == 0 ? adopters.begin() : adopters.lower_bound(cfg.claim_start_key);

  stats_table stats(get_self(), get_self().value);
  auto current_stats = stats.get_or_default();
  if (current_stats.total_rewards_distributed.symbol != invite_symbol) {
    current_stats.total_rewards_distributed = asset(0, invite_symbol);
  }

  uint32_t processed = 0;
  int64_t distributed = 0;
  bool stats_updated = false;

  while (itr != adopters.end() && processed < cfg.claim_limit && distributed < contract_balance.amount) {
    auto current = itr++;
    ++processed;

    if (current->score == 0 || current->banked.amount <= 0 || current->banked.symbol != invite_symbol) {
      continue;
    }

    const uint32_t position = calculate_tetrahedral_position(current->score);
    if (position == 0) continue;

    const uint64_t banked_amount = static_cast<uint64_t>(current->banked.amount);

    const uint64_t weighted_amount = banked_amount * position;

    const uint64_t numerator = reward_pool_amount_u * weighted_amount;
    const uint64_t reward_amount_u = numerator / total_banked_amount;

    if (reward_amount_u == 0) continue;

    int64_t reward_amount = static_cast<int64_t>(reward_amount_u);
    if (reward_amount > contract_balance.amount - distributed) {
      reward_amount = contract_balance.amount - distributed;
    }
    if (reward_amount <= 0) break;

    asset reward = asset(reward_amount, invite_symbol);
    distributed += reward_amount;

    const asset weighted = asset(static_cast<int64_t>(weighted_amount), invite_symbol);
    const string reward_memo = "EASY Life 🍹 Level " + std::to_string(position) +
      " 🏆 " + std::to_string(current->score) +
      " 🏦 " + format_whole_amount(current->banked) +
      " ⚖️💰 " + format_whole_amount(weighted) + " 🖱 flex.town";

    action(
      permission_level{get_self(), "active"_n},
      cfg.token_contract,
      "transfer"_n,
      std::make_tuple(get_self(), current->account, reward, reward_memo)
    ).send();

    current_stats.total_rewards_distributed += reward;
    stats_updated = true;
  }

  if (stats_updated) {
    stats.set(current_stats, get_self());
  }

  // -- Update pagination
  uint64_t next_start_key = itr == adopters.end() ? 0 : itr->account.value;
  conf.set(config{
    .enabled = cfg.enabled,
    .admin = cfg.admin,
    .max_invite_depth = cfg.max_invite_depth,
    .claim_start_key = next_start_key,
    .claim_limit = cfg.claim_limit,
    .min_invite_amount = cfg.min_invite_amount,
    .token_contract = cfg.token_contract,
    .reflections_account = cfg.reflections_account,
    .inbank_account = cfg.inbank_account
  }, get_self());
}//END claimreward()

// === Set Config === //
// --- Admin sets contract-wide configuration --- //

void easyinvite::setconfig(
    name admin,
    bool enabled,
    uint16_t max_depth,
    uint32_t claim_limit,
    asset min_invite_amount,
    name token_contract,
    name reflections_account,
    name inbank_account
) {
    // - Initialize config table
    config_table conf(get_self(), get_self().value);

    // - Parameter validation
    check(max_depth > 0 && max_depth <= 10, "Invalid depth (1-10)");
    check(is_account(admin), "New admin account does not exist");
    check(claim_limit > 0 && claim_limit <= 1000, "Claim limit must be 1-1000");
    check(min_invite_amount.amount > 0, "Minimum invite amount must be positive");
    check(is_account(token_contract), "Token contract does not exist");
    check(is_account(inbank_account), "Inbank account does not exist");

    // - Handle first-time initialization
    if (!conf.exists()) {
        require_auth(get_self());
        conf.set(config{
            .enabled = enabled,
            .admin = admin,
            .max_invite_depth = max_depth,
            .claim_start_key = 0,
            .claim_limit = claim_limit,
            .min_invite_amount = min_invite_amount,
            .token_contract = token_contract,
            .reflections_account = reflections_account,
            .inbank_account = inbank_account
        }, get_self());
        return;
    }

    // - Normal admin updates
    auto current = conf.get();
    require_auth(current.admin);

    // - Update configuration
    conf.set(config{
        .enabled = enabled,
        .admin = admin,
        .max_invite_depth = max_depth,
        .claim_start_key = current.claim_start_key,
        .claim_limit = claim_limit,
        .min_invite_amount = min_invite_amount,
        .token_contract = token_contract,
        .reflections_account = reflections_account,
        .inbank_account = inbank_account
    }, get_self());
}//END setconfig()

// === Delete User === //
// --- Development utility to remove a user --- //

void easyinvite::deleteuser(name user) {
  // - Authorization check
  require_auth(get_self());

  // - Remove user record
  adopters_table adopters(get_self(), get_self().value);
  auto itr = adopters.find(user.value);
  if (itr != adopters.end()) {
    adopters.erase(itr);
  } else {
    check(false, "❇️ User not found in our records");
  }
}//END deleteuser()
