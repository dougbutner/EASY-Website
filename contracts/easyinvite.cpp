#include "easyinvite.hpp"
#include <algorithm>
#include <cctype>

// === Paid Invite Transfer === //
// --- Registers memo account, banks half, and forwards the other half --- //

void easyinvite::on_transfer(name from, name to, asset quantity, string memo) {
  if (from == get_self() || to != get_self()) return;

  const name token_contract = get_first_receiver();
  if (token_contract == "eosio.token"_n && quantity.symbol == symbol(symbol_code("XPR"), 4)) {
    check(quantity.amount > 0, "XPR transfer must be positive");
    return;
  }

  config_table conf(get_self(), get_self().value);
  auto cfg = conf.get_or_default();
  const symbol invite_symbol = cfg.min_invite_amount.symbol;
  check(token_contract == cfg.token_contract,
    "Only " + invite_symbol.code().to_string() + " is accepted here 🤷");

  const asset zero_invite = asset(0, invite_symbol);

  check(quantity.symbol == invite_symbol, "Only " + invite_symbol.code().to_string() + " can be used to invite");
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
    invite_memos_table memos(get_self(), get_self().value);
    auto by_time = requests.get_index<"bytime"_n>();
    check(by_time.begin() != by_time.end(), "No pending invite requests");
    auto pick = by_time.end();
    --pick;
    while (adopters.find(pick->account.value) != adopters.end()) {
      if (auto memo_itr = memos.find(pick->account.value); memo_itr != memos.end()) {
        port_memo_to_member(memo_itr->account, memo_itr->request, memo_itr->nation, from);
        memos.erase(memo_itr);
      }
      by_time.erase(pick);
      check(by_time.begin() != by_time.end(), "No pending invite requests");
      pick = by_time.end();
      --pick;
    }
    invited_account = pick->account;
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
  invite_memos_table memos(get_self(), get_self().value);
  auto pending_request = requests.find(invited_account.value);
  if (pending_request != requests.end()) {
    requests.erase(pending_request);
  }
  auto pending_memo = memos.find(invited_account.value);
  if (pending_memo != memos.end()) {
    if (welcomed_now) {
      port_memo_to_member(pending_memo->account, pending_memo->request, pending_memo->nation, from);
    }
    memos.erase(pending_memo);
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

void easyinvite::ask4invite(name account, name requester, string request, string nation_iso3) {
  require_auth(requester);
  check(is_account(account), "Requested account does not exist");
  check(is_account(requester), "Requester account does not exist");
  check(!request.empty(), "Invite request message is required");
  check(request.size() <= 220, "Invite request message must be 220 characters or less");

  config_table conf(get_self(), get_self().value);
  auto cfg = conf.get_or_default();
  check(cfg.enabled, "❇️ Sorry, registration is paused right now");

  adopters_table adopters(get_self(), get_self().value);
  check(adopters.find(account.value) == adopters.end(), "❇️ This account has already been welcomed");

  invite_requests_table requests(get_self(), get_self().value);
  check(requests.find(account.value) == requests.end(), "This account already has a pending invite request");

  invite_memos_table memos(get_self(), get_self().value);

  uint32_t nation = 0;
  if (!nation_iso3.empty()) {
    nation = is_valid_country(0, nation_iso3);
  }

  requests.emplace(requester, [&](auto& row) {
    row.account = account;
    row.requester = requester;
    row.requested_at = current_time_point().sec_since_epoch();
  });

  memos.emplace(requester, [&](auto& row) {
    row.account = account;
    row.request = request;
    row.nation = nation;
  });
}//END ask4invite()

// === Clean Invite Requests === //
// --- Drops stale queue rows for accounts already welcomed --- //

void easyinvite::cleanasks() {
  adopters_table adopters(get_self(), get_self().value);
  invite_requests_table requests(get_self(), get_self().value);
  invite_memos_table memos(get_self(), get_self().value);
  auto by_time = requests.get_index<"bytime"_n>();

  uint32_t examined = 0;
  auto itr = by_time.begin();
  while (itr != by_time.end() && examined < 999) {
    ++examined;
    if (adopters.find(itr->account.value) != adopters.end()) {
      if (auto memo_itr = memos.find(itr->account.value); memo_itr != memos.end()) {
        port_memo_to_member(memo_itr->account, memo_itr->request, memo_itr->nation, get_self());
        memos.erase(memo_itr);
      }
      itr = by_time.erase(itr);
    } else {
      ++itr;
    }
  }
}//END cleanasks()

// === Clean Legacy Invite Requests === //
// --- Drops queue rows with no invite memo (oldest 12 checked) --- //

void easyinvite::cleannomemo() {
  invite_requests_table requests(get_self(), get_self().value);
  invite_memos_table memos(get_self(), get_self().value);
  auto by_time = requests.get_index<"bytime"_n>();

  uint32_t examined = 0;
  auto itr = by_time.begin();
  while (itr != by_time.end() && examined < 999) {
    ++examined;
    if (memos.find(itr->account.value) == memos.end()) {
      itr = by_time.erase(itr);
    } else {
      ++itr;
    }
  }
}//END cleannomemo()

// === Update Member Info === //
// --- Member updates profile info, nation, and link --- //

void easyinvite::updateinfo(name account, string info, string nation_iso3, string link) {
  require_auth(account);

  adopters_table adopters(get_self(), get_self().value);
  check(adopters.find(account.value) != adopters.end(), "Not a member");
  check(!info.empty(), "Info is required");
  check(info.size() <= 500, "Info must be 500 characters or less");

  uint32_t nation = 0;
  if (!nation_iso3.empty()) {
    nation = is_valid_country(0, nation_iso3);
  }

  string clean_link;
  if (!link.empty()) {
    clean_link = link;
    const size_t hash = clean_link.find('#');
    if (hash != string::npos) clean_link = clean_link.substr(0, hash);
    if (clean_link.size() >= 8 && clean_link.compare(0, 8, "https://") == 0) clean_link = clean_link.substr(8);
    else if (clean_link.size() >= 7 && clean_link.compare(0, 7, "http://") == 0) clean_link = clean_link.substr(7);
    if (clean_link.size() >= 4 && clean_link.compare(0, 4, "www.") == 0) clean_link = clean_link.substr(4);
    check(clean_link.find('.') != string::npos, "Link must be a link");
    check(clean_link.size() <= 200, "Link must be 200 characters or less");
  }

  member_info_table memberinfo(get_self(), get_self().value);
  auto itr = memberinfo.find(account.value);
  if (itr == memberinfo.end()) {
    memberinfo.emplace(account, [&](auto& row) {
      row.account = account;
      row.info = info;
      row.nation = nation;
      row.link = clean_link;
    });
  } else {
    memberinfo.modify(itr, same_payer, [&](auto& row) {
      row.info = info;
      row.nation = nation;
      row.link = clean_link;
    });
  }
}//END updateinfo()

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

  const uint64_t reward_pool_amount_u = static_cast<uint64_t>(contract_balance.amount) / 6;
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

    if (current->score == 0 || current->banked.symbol != invite_symbol) {
      continue;
    }

    const uint32_t position = calculate_tetrahedral_position(current->score);
    if (position == 0) continue;

    if (current->banked.amount <= 0) {
      accounts accountstable(cfg.token_contract, current->account.value);
      if (auto ac = accountstable.find(invite_symbol.code().raw()); ac == accountstable.end() || ac->balance.amount < int64_t(pow(10, invite_symbol.precision()))) continue;

      const int64_t dust = 1;
      if (distributed + dust > contract_balance.amount) break;

      const string reward_memo = "Level " + std::to_string(position) +
        " 🏆 " + std::to_string(current->score) +
        " 🏦 0 Bank 🙈 Fix it by welcoming a friend 🖱 flex.town";

      action(
        permission_level{get_self(), "active"_n},
        cfg.token_contract,
        "transfer"_n,
        std::make_tuple(get_self(), current->account, asset(dust, invite_symbol), reward_memo)
      ).send();

      distributed += dust;
      current_stats.total_rewards_distributed += asset(dust, invite_symbol);
      stats_updated = true;
      continue;
    }

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

  member_info_table memberinfo(get_self(), get_self().value);
  if (auto info_itr = memberinfo.find(user.value); info_itr != memberinfo.end()) {
    memberinfo.erase(info_itr);
  }
}//END deleteuser()

// === Delete Invite Request === //
// --- Contract-only removal from queue and memo tables --- //

void easyinvite::delinvreq(name account) {
  require_auth(get_self());

  invite_requests_table requests(get_self(), get_self().value);
  invite_memos_table memos(get_self(), get_self().value);

  bool removed = false;
  if (auto req = requests.find(account.value); req != requests.end()) {
    requests.erase(req);
    removed = true;
  }
  if (auto memo = memos.find(account.value); memo != memos.end()) {
    memos.erase(memo);
    removed = true;
  }
  check(removed, "❇️ No pending invite request found for this account");
}//END delinvreq()

void easyinvite::port_memo_to_member(name account, const string& info, uint32_t nation, name payer) {
  member_info_table memberinfo(get_self(), get_self().value);
  if (memberinfo.find(account.value) != memberinfo.end()) return;
  memberinfo.emplace(payer, [&](auto& row) {
    row.account = account;
    row.info = info;
    row.nation = nation;
    row.link = "";
  });
}

string easyinvite::normalize_enum_name(const string& input) {
    string output = input;
    std::transform(output.begin(), output.end(), output.begin(), [](unsigned char c) {
        return static_cast<char>(std::toupper(c));
    });
    std::replace(output.begin(), output.end(), ' ', '_');
    return output;
}
uint32_t easyinvite::is_valid_country(uint32_t code, const string country_iso3) {
    if (!country_iso3.empty()) {
        string enum_name = normalize_enum_name(country_iso3);
        if (enum_name == "AFG") return 4;
        else if (enum_name == "ALA") return 248;
        else if (enum_name == "ALB") return 8;
        else if (enum_name == "DZA") return 12;
        else if (enum_name == "ASM") return 16;
        else if (enum_name == "AND") return 20;
        else if (enum_name == "AGO") return 24;
        else if (enum_name == "AIA") return 660;
        else if (enum_name == "ATA") return 10;
        else if (enum_name == "ATG") return 28;
        else if (enum_name == "ARG") return 32;
        else if (enum_name == "ARM") return 51;
        else if (enum_name == "ABW") return 533;
        else if (enum_name == "AUS") return 36;
        else if (enum_name == "AUT") return 40;
        else if (enum_name == "AZE") return 31;
        else if (enum_name == "BHS") return 44;
        else if (enum_name == "BHR") return 48;
        else if (enum_name == "BGD") return 50;
        else if (enum_name == "BRB") return 52;
        else if (enum_name == "BLR") return 112;
        else if (enum_name == "BEL") return 56;
        else if (enum_name == "BLZ") return 84;
        else if (enum_name == "BEN") return 204;
        else if (enum_name == "BMU") return 60;
        else if (enum_name == "BTN") return 64;
        else if (enum_name == "BOL") return 68;
        else if (enum_name == "BES") return 535;
        else if (enum_name == "BIH") return 70;
        else if (enum_name == "BWA") return 72;
        else if (enum_name == "BVT") return 74;
        else if (enum_name == "BRA") return 76;
        else if (enum_name == "IOT") return 86;
        else if (enum_name == "VGB") return 92;
        else if (enum_name == "BRN") return 96;
        else if (enum_name == "BGR") return 100;
        else if (enum_name == "BFA") return 854;
        else if (enum_name == "BDI") return 108;
        else if (enum_name == "CPV") return 132;
        else if (enum_name == "KHM") return 116;
        else if (enum_name == "CMR") return 120;
        else if (enum_name == "CAN") return 124;
        else if (enum_name == "CYM") return 136;
        else if (enum_name == "CAF") return 140;
        else if (enum_name == "TCD") return 148;
        else if (enum_name == "CHL") return 152;
        else if (enum_name == "CHN") return 156;
        else if (enum_name == "HKG") return 344;
        else if (enum_name == "MAC") return 446;
        else if (enum_name == "CXR") return 162;
        else if (enum_name == "CCK") return 166;
        else if (enum_name == "COL") return 170;
        else if (enum_name == "COM") return 174;
        else if (enum_name == "COG") return 178;
        else if (enum_name == "COD") return 180;
        else if (enum_name == "COK") return 184;
        else if (enum_name == "CRI") return 188;
        else if (enum_name == "CIV") return 384;
        else if (enum_name == "HRV") return 191;
        else if (enum_name == "CUB") return 192;
        else if (enum_name == "CUW") return 531;
        else if (enum_name == "CYP") return 196;
        else if (enum_name == "CZE") return 203;
        else if (enum_name == "DNK") return 208;
        else if (enum_name == "DJI") return 262;
        else if (enum_name == "DMA") return 212;
        else if (enum_name == "DOM") return 214;
        else if (enum_name == "ECU") return 218;
        else if (enum_name == "EGY") return 818;
        else if (enum_name == "SLV") return 222;
        else if (enum_name == "GNQ") return 226;
        else if (enum_name == "ERI") return 232;
        else if (enum_name == "EST") return 233;
        else if (enum_name == "SWZ") return 748;
        else if (enum_name == "ETH") return 231;
        else if (enum_name == "FLK") return 238;
        else if (enum_name == "FRO") return 234;
        else if (enum_name == "FJI") return 242;
        else if (enum_name == "FIN") return 246;
        else if (enum_name == "FRA") return 250;
        else if (enum_name == "GUF") return 254;
        else if (enum_name == "PYF") return 258;
        else if (enum_name == "ATF") return 260;
        else if (enum_name == "GAB") return 266;
        else if (enum_name == "GMB") return 270;
        else if (enum_name == "GEO") return 268;
        else if (enum_name == "DEU") return 276;
        else if (enum_name == "GHA") return 288;
        else if (enum_name == "GIB") return 292;
        else if (enum_name == "GRC") return 300;
        else if (enum_name == "GRL") return 304;
        else if (enum_name == "GRD") return 308;
        else if (enum_name == "GLP") return 312;
        else if (enum_name == "GUM") return 316;
        else if (enum_name == "GTM") return 320;
        else if (enum_name == "GGY") return 831;
        else if (enum_name == "GIN") return 324;
        else if (enum_name == "GNB") return 624;
        else if (enum_name == "GUY") return 328;
        else if (enum_name == "HTI") return 332;
        else if (enum_name == "HMD") return 334;
        else if (enum_name == "VAT") return 336;
        else if (enum_name == "HND") return 340;
        else if (enum_name == "HUN") return 348;
        else if (enum_name == "ISL") return 352;
        else if (enum_name == "IND") return 356;
        else if (enum_name == "IDN") return 360;
        else if (enum_name == "IRN") return 364;
        else if (enum_name == "IRQ") return 368;
        else if (enum_name == "IRL") return 372;
        else if (enum_name == "IMN") return 833;
        else if (enum_name == "ISR") return 376;
        else if (enum_name == "ITA") return 380;
        else if (enum_name == "JAM") return 388;
        else if (enum_name == "JPN") return 392;
        else if (enum_name == "JEY") return 832;
        else if (enum_name == "JOR") return 400;
        else if (enum_name == "KAZ") return 398;
        else if (enum_name == "KEN") return 404;
        else if (enum_name == "KIR") return 296;
        else if (enum_name == "PRK") return 408;
        else if (enum_name == "KOR") return 410;
        else if (enum_name == "KWT") return 414;
        else if (enum_name == "KGZ") return 417;
        else if (enum_name == "LAO") return 418;
        else if (enum_name == "LVA") return 428;
        else if (enum_name == "LBN") return 422;
        else if (enum_name == "LSO") return 426;
        else if (enum_name == "LBR") return 430;
        else if (enum_name == "LBY") return 434;
        else if (enum_name == "LIE") return 438;
        else if (enum_name == "LTU") return 440;
        else if (enum_name == "LUX") return 442;
        else if (enum_name == "MDG") return 450;
        else if (enum_name == "MWI") return 454;
        else if (enum_name == "MYS") return 458;
        else if (enum_name == "MDV") return 462;
        else if (enum_name == "MLI") return 466;
        else if (enum_name == "MLT") return 470;
        else if (enum_name == "MHL") return 584;
        else if (enum_name == "MTQ") return 474;
        else if (enum_name == "MRT") return 478;
        else if (enum_name == "MUS") return 480;
        else if (enum_name == "MYT") return 175;
        else if (enum_name == "MEX") return 484;
        else if (enum_name == "FSM") return 583;
        else if (enum_name == "MCO") return 492;
        else if (enum_name == "MNG") return 496;
        else if (enum_name == "MNE") return 499;
        else if (enum_name == "MSR") return 500;
        else if (enum_name == "MAR") return 504;
        else if (enum_name == "MOZ") return 508;
        else if (enum_name == "MMR") return 104;
        else if (enum_name == "NAM") return 516;
        else if (enum_name == "NRU") return 520;
        else if (enum_name == "NPL") return 524;
        else if (enum_name == "NLD") return 528;
        else if (enum_name == "NCL") return 540;
        else if (enum_name == "NZL") return 554;
        else if (enum_name == "NIC") return 558;
        else if (enum_name == "NER") return 562;
        else if (enum_name == "NGA") return 566;
        else if (enum_name == "NIU") return 570;
        else if (enum_name == "NFK") return 574;
        else if (enum_name == "MNP") return 580;
        else if (enum_name == "NOR") return 578;
        else if (enum_name == "OMN") return 512;
        else if (enum_name == "PAK") return 586;
        else if (enum_name == "PLW") return 585;
        else if (enum_name == "PSE") return 275;
        else if (enum_name == "PAN") return 591;
        else if (enum_name == "PNG") return 598;
        else if (enum_name == "PRY") return 600;
        else if (enum_name == "PER") return 604;
        else if (enum_name == "PHL") return 608;
        else if (enum_name == "PCN") return 612;
        else if (enum_name == "POL") return 616;
        else if (enum_name == "PRT") return 620;
        else if (enum_name == "PRI") return 630;
        else if (enum_name == "QAT") return 634;
        else if (enum_name == "REU") return 638;
        else if (enum_name == "ROU") return 642;
        else if (enum_name == "RUS") return 643;
        else if (enum_name == "RWA") return 646;
        else if (enum_name == "BLM") return 652;
        else if (enum_name == "SHN") return 654;
        else if (enum_name == "KNA") return 659;
        else if (enum_name == "LCA") return 662;
        else if (enum_name == "MAF") return 663;
        else if (enum_name == "SPM") return 666;
        else if (enum_name == "VCT") return 670;
        else if (enum_name == "WSM") return 882;
        else if (enum_name == "SMR") return 674;
        else if (enum_name == "STP") return 678;
        else if (enum_name == "SAU") return 682;
        else if (enum_name == "SEN") return 686;
        else if (enum_name == "SRB") return 688;
        else if (enum_name == "SYC") return 690;
        else if (enum_name == "SLE") return 694;
        else if (enum_name == "SGP") return 702;
        else if (enum_name == "SXM") return 534;
        else if (enum_name == "SVK") return 703;
        else if (enum_name == "SVN") return 705;
        else if (enum_name == "SLB") return 90;
        else if (enum_name == "SOM") return 706;
        else if (enum_name == "ZAF") return 710;
        else if (enum_name == "SGS") return 239;
        else if (enum_name == "SSD") return 728;
        else if (enum_name == "ESP") return 724;
        else if (enum_name == "LKA") return 144;
        else if (enum_name == "SDN") return 729;
        else if (enum_name == "SUR") return 740;
        else if (enum_name == "SJM") return 744;
        else if (enum_name == "SWE") return 752;
        else if (enum_name == "CHE") return 756;
        else if (enum_name == "SYR") return 760;
        else if (enum_name == "TWN") return 158;
        else if (enum_name == "TJK") return 762;
        else if (enum_name == "TZA") return 834;
        else if (enum_name == "THA") return 764;
        else if (enum_name == "TLS") return 626;
        else if (enum_name == "TGO") return 768;
        else if (enum_name == "TKL") return 772;
        else if (enum_name == "TON") return 776;
        else if (enum_name == "TTO") return 780;
        else if (enum_name == "TUN") return 788;
        else if (enum_name == "TUR") return 792;
        else if (enum_name == "TKM") return 795;
        else if (enum_name == "TCA") return 796;
        else if (enum_name == "TUV") return 798;
        else if (enum_name == "UGA") return 800;
        else if (enum_name == "UKR") return 804;
        else if (enum_name == "ARE") return 784;
        else if (enum_name == "GBR") return 826;
        else if (enum_name == "USA") return 840;
        else if (enum_name == "UMI") return 581;
        else if (enum_name == "URY") return 858;
        else if (enum_name == "UZB") return 860;
        else if (enum_name == "VUT") return 548;
        else if (enum_name == "VEN") return 862;
        else if (enum_name == "VNM") return 704;
        else if (enum_name == "VGB") return 92;
        else if (enum_name == "VIR") return 850;
        else if (enum_name == "WLF") return 876;
        else if (enum_name == "ESH") return 732;
        else if (enum_name == "YEM") return 887;
        else if (enum_name == "ZMB") return 894;
        else if (enum_name == "ZWE") return 716;
        else {
            check(false, "⚡️ The three-letter country code isn't valid. Use ISO 3166-1 alpha-3 codes.");
            return 0;
        }
    } else {
        switch(code) {
            case 4: return 4;
            case 248: return 248;
            case 8: return 8;
            case 12: return 12;
            case 16: return 16;
            case 20: return 20;
            case 24: return 24;
            case 660: return 660;
            case 10: return 10;
            case 28: return 28;
            case 32: return 32;
            case 51: return 51;
            case 533: return 533;
            case 36: return 36;
            case 40: return 40;
            case 31: return 31;
            case 44: return 44;
            case 48: return 48;
            case 50: return 50;
            case 52: return 52;
            case 112: return 112;
            case 56: return 56;
            case 84: return 84;
            case 204: return 204;
            case 60: return 60;
            case 64: return 64;
            case 68: return 68;
            case 535: return 535;
            case 70: return 70;
            case 72: return 72;
            case 74: return 74;
            case 76: return 76;
            case 86: return 86;
            case 92: return 92;
            case 96: return 96;
            case 100: return 100;
            case 854: return 854;
            case 108: return 108;
            case 132: return 132;
            case 116: return 116;
            case 120: return 120;
            case 124: return 124;
            case 136: return 136;
            case 140: return 140;
            case 148: return 148;
            case 152: return 152;
            case 156: return 156;
            case 344: return 344;
            case 446: return 446;
            case 162: return 162;
            case 166: return 166;
            case 170: return 170;
            case 174: return 174;
            case 178: return 178;
            case 180: return 180;
            case 184: return 184;
            case 188: return 188;
            case 384: return 384;
            case 191: return 191;
            case 192: return 192;
            case 531: return 531;
            case 196: return 196;
            case 203: return 203;
            case 208: return 208;
            case 262: return 262;
            case 212: return 212;
            case 214: return 214;
            case 218: return 218;
            case 818: return 818;
            case 222: return 222;
            case 226: return 226;
            case 232: return 232;
            case 233: return 233;
            case 748: return 748;
            case 231: return 231;
            case 238: return 238;
            case 234: return 234;
            case 242: return 242;
            case 246: return 246;
            case 250: return 250;
            case 254: return 254;
            case 258: return 258;
            case 260: return 260;
            case 266: return 266;
            case 270: return 270;
            case 268: return 268;
            case 276: return 276;
            case 288: return 288;
            case 292: return 292;
            case 300: return 300;
            case 304: return 304;
            case 308: return 308;
            case 312: return 312;
            case 316: return 316;
            case 320: return 320;
            case 831: return 831;
            case 324: return 324;
            case 624: return 624;
            case 328: return 328;
            case 332: return 332;
            case 334: return 334;
            case 336: return 336;
            case 340: return 340;
            case 348: return 348;
            case 352: return 352;
            case 356: return 356;
            case 360: return 360;
            case 364: return 364;
            case 368: return 368;
            case 372: return 372;
            case 833: return 833;
            case 376: return 376;
            case 380: return 380;
            case 388: return 388;
            case 392: return 392;
            case 832: return 832;
            case 400: return 400;
            case 398: return 398;
            case 404: return 404;
            case 296: return 296;
            case 408: return 408;
            case 410: return 410;
            case 414: return 414;
            case 417: return 417;
            case 418: return 418;
            case 428: return 428;
            case 422: return 422;
            case 426: return 426;
            case 430: return 430;
            case 434: return 434;
            case 438: return 438;
            case 440: return 440;
            case 442: return 442;
            case 450: return 450;
            case 454: return 454;
            case 458: return 458;
            case 462: return 462;
            case 466: return 466;
            case 470: return 470;
            case 584: return 584;
            case 474: return 474;
            case 478: return 478;
            case 480: return 480;
            case 175: return 175;
            case 484: return 484;
            case 583: return 583;
            case 492: return 492;
            case 496: return 496;
            case 499: return 499;
            case 500: return 500;
            case 504: return 504;
            case 508: return 508;
            case 104: return 104;
            case 516: return 516;
            case 520: return 520;
            case 524: return 524;
            case 528: return 528;
            case 540: return 540;
            case 554: return 554;
            case 558: return 558;
            case 562: return 562;
            case 566: return 566;
            case 570: return 570;
            case 574: return 574;
            case 807: return 807;
            case 580: return 580;
            case 578: return 578;
            case 512: return 512;
            case 586: return 586;
            case 585: return 585;
            case 591: return 591;
            case 598: return 598;
            case 600: return 600;
            case 604: return 604;
            case 608: return 608;
            case 612: return 612;
            case 616: return 616;
            case 620: return 620;
            case 630: return 630;
            case 634: return 634;
            case 498: return 498;
            case 638: return 638;
            case 642: return 642;
            case 643: return 643;
            case 646: return 646;
            case 652: return 652;
            case 654: return 654;
            case 659: return 659;
            case 662: return 662;
            case 663: return 663;
            case 666: return 666;
            case 670: return 670;
            case 882: return 882;
            case 674: return 674;
            case 678: return 678;
            case 682: return 682;
            case 686: return 686;
            case 688: return 688;
            case 690: return 690;
            case 694: return 694;
            case 702: return 702;
            case 534: return 534;
            case 703: return 703;
            case 705: return 705;
            case 90: return 90;
            case 706: return 706;
            case 710: return 710;
            case 239: return 239;
            case 728: return 728;
            case 724: return 724;
            case 144: return 144;
            case 275: return 275;
            case 729: return 729;
            case 740: return 740;
            case 744: return 744;
            case 752: return 752;
            case 756: return 756;
            case 760: return 760;
            case 158: return 158;
            case 762: return 762;
            case 834: return 834;
            case 764: return 764;
            case 626: return 626;
            case 768: return 768;
            case 772: return 772;
            case 776: return 776;
            case 780: return 780;
            case 788: return 788;
            case 792: return 792;
            case 795: return 795;
            case 796: return 796;
            case 798: return 798;
            case 800: return 800;
            case 804: return 804;
            case 784: return 784;
            case 826: return 826;
            case 581: return 581;
            case 840: return 840;
            case 850: return 850;
            case 858: return 858;
            case 860: return 860;
            case 548: return 548;
            case 862: return 862;
            case 704: return 704;
            case 876: return 876;
            case 732: return 732;
            case 887: return 887;
            case 894: return 894;
            case 716: return 716;
            default: { 
                check(false, "⚡️ The three-digit country code isn't valid. You can also use ISO 3166-1 three-letter codes in the correct field.");
                return 0;
            }
        }
    }
}
