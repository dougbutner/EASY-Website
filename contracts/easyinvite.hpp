#pragma once
#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>
#include <string>
#include <climits>
#include <vector>

using namespace eosio;
using std::string;

// === easyinvite Contract === //
// --- Multi-level invite management system --- //

CONTRACT easyinvite : public contract {
public:
  using contract::contract;

  // === User Actions === //
  // --- Core user interactions --- //

  // - Claim rewards for the next configured page of adopters
  ACTION claimreward();

  // - Join the queue for a paid invite with personal message and optional nation
  ACTION ask4invite(name account, name requester, string request, string nation_iso3);

  // - Remove stale queue rows for accounts already in adopters (oldest 12 checked)
  ACTION cleanasks();

  // - Remove legacy queue rows with no invite memo (oldest 12 checked)
  ACTION cleannomemo();

  // - Contract-only removal from invite queue and memo tables
  ACTION delinvreq(name account);

  // - Member updates profile info, nation, and link
  ACTION updateinfo(name account, string info, string nation_iso3, string link);

  // - Admin configuration management
  ACTION setconfig(
      name admin,
      bool enabled,
      uint16_t max_depth,
      uint32_t claim_limit,
      asset min_invite_amount,
      name token_contract,
      name reflections_account,
      name inbank_account
  );

  // - Development utility action
  ACTION deleteuser(name user);

  // - Register paid invites from EASY transfers
  [[eosio::on_notify("*::transfer")]]
  void on_transfer(name from, name to, asset quantity, string memo);

  // === Adopter Table === //
  // --- Tracks registered users and invite statistics --- //

  /*/
  Tracks each registered user and their invite stats
  /*/
  TABLE adopter {
    name        account;          // - Account name
    name        invitedby;        // - Inviter account
    uint32_t    lastupdated;      // - Last score update timestamp
    uint32_t    score = 0;        // - Current invite score
    asset       banked;           // - EASY paid into inbank through invites

    uint64_t primary_key() const { return account.value; }
    uint64_t by_score() const { return static_cast<uint64_t>(UINT32_MAX - score); } // - Sort descending
  };

  using adopters_table = multi_index<"adopters"_n, adopter,
    indexed_by<"byscore"_n, const_mem_fun<adopter, uint64_t, &adopter::by_score>>
  >;

  // === Invite Request Table === //
  // --- Accounts waiting for a paid invite --- //

  TABLE invite_request {
    name     account;       // - Account named in the request
    name     requester;     // - Account that submitted the request
    uint32_t requested_at;  // - Request timestamp

    uint64_t primary_key() const { return account.value; }
    uint64_t by_time() const { return static_cast<uint64_t>(requested_at); }
  };

  using invite_requests_table = multi_index<"invrequests"_n, invite_request,
    indexed_by<"bytime"_n, const_mem_fun<invite_request, uint64_t, &invite_request::by_time>>
  >;

  // === Invite Memo Table === //
  // --- Personal invite request message and nation --- //

  TABLE invite_memo {
    name     account;
    string   request;
    uint32_t nation;

    uint64_t primary_key() const { return account.value; }
  };

  using invite_memos_table = multi_index<"invreqmemo"_n, invite_memo>;

  // === Member Info Table === //
  // --- Persisted profile after welcome --- //

  TABLE member_info {
    name     account;
    string   info;
    uint32_t nation;
    string   link;

    uint64_t primary_key() const { return account.value; }
  };

  using member_info_table = multi_index<"memberinfo"_n, member_info>;

  // === Config Singleton === //
  // --- Contract configuration values --- //

  /*/
  Stores contract-wide configuration parameters
  /*/
  TABLE config {
    bool     enabled = true;             // - Contract operational status
    name     admin;                      // - Admin account
    uint16_t max_invite_depth = 5;       // - Maximum invite upline levels
    uint64_t claim_start_key = 0;        // - Next adopter primary key for paged claims
    uint32_t claim_limit = 100;          // - Maximum adopters checked per claim action
    asset    min_invite_amount = asset(200000000, symbol(symbol_code("EASY"), 6)); // - Minimum invite token required for paid invite
    name     token_contract = "mon3y"_n;       // - Token issuer contract for paid invites and claims
    name     reflections_account = "reflections"_n; // - Default inviter when payer is not registered
    name     inbank_account = "inbank.mon3y"_n;      // - Account that receives banked invite proceeds
  };

  using config_table = singleton<"config"_n, config>;

  // === Stats Singleton === //
  // --- Global contract statistics --- //

  /*/
  Tracks global invite and user statistics
  /*/
  TABLE stats {
    uint64_t total_invite_score = 0; // - Total invite score increments across all adopters
    uint64_t total_users = 0;        // - Total registered users
    asset    total_rewards_distributed = asset(0, symbol(symbol_code("EASY"), 6)); // - Cumulative EASY paid by claimreward
    name     last_registered;        // - Most recent registration
  };

  using stats_table = singleton<"stats"_n, stats>;

  // - Same pattern as eosio.token / takeiteasy: read issuer accounts table scoped to owner
  static asset get_balance(const name& token_contract_account, const name& owner, const symbol_code& sym_code) {
    accounts accountstable(token_contract_account, owner.value);
    const auto& ac = accountstable.get(sym_code.raw(), "no balance with specified symbol");
    return ac.balance;
  }

  static string format_whole_amount(const asset& a);

private:
  TABLE account {
    asset    balance;
    uint64_t primary_key() const { return balance.symbol.code().raw(); }
  };

  using accounts = multi_index<"accounts"_n, account>;

  // === Constants === //
  // --- Tetrahedral series values --- //

  // - Pre-calculated tetrahedral series values
  const std::vector<uint32_t> TETRAHEDRAL = {
    1, 4, 10, 20, 35, 56, 84, 120, 165, 220,          // 1-10
    286, 364, 455, 560, 680, 816, 969, 1140, 1330, 1540,   // 11-20
    1771, 2024, 2300, 2600, 2925, 3276, 3654, 4060, 4495, 4960, // 21-30
    5456, 5984, 6545, 7140, 7770, 8436, 9139, 9880, 10660, 11480, // 31-40
    12341, 13244, 14190, 15180, 16215, 17296, 18424, 19600, 20825, 22100, // 41-50
    23426, 24804, 26235, 27720, 29260, 30856, 32509, 34220, 35990, 37820, // 51-60
    39711, 41664, 43680, 45760, 47905, 50116, 52394, 54740, 57155, 59640, // 61-70
    62196, 64824, 67525, 70300, 73150, 76076, 79079, 82160, 85320, 88560, // 71-80
    91881, 95284, 98770, 102340, 105995, 109736, 113564, 117480, 121485, 125580, // 81-90
    129766, 134044, 138415, 142880, 147440, 152096, 156849, 161700, 166650, 999999999
};
  string normalize_enum_name(const string& input);
  uint32_t is_valid_country(uint32_t code, const string country_iso3);
  void port_memo_to_member(name account, const string& info, uint32_t nation, name payer);

  // - Calculates position in tetrahedral series
  uint32_t calculate_tetrahedral_position(uint32_t score) {
    // - Find largest n where T(n) <= score
    for (size_t i = 0; i < TETRAHEDRAL.size(); i++) {
      if (TETRAHEDRAL[i] > score) {
        return i; // - Return index where score exceeded
      }
    }
    return TETRAHEDRAL.size() - 1; // - Return last position for large scores
  }//END calculate_tetrahedral_position()
};