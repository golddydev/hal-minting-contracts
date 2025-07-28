use hal_nft_mint/whitelist.{WhitelistedItem, WhitelistedValue}
use tests/mocks/fake_constants.{
  one_hour_in_milliseconds, two_hours_in_milliseconds,
}
use validations/minting_data/utils.{update_whitelisted_value}

test can_update_whitelisted_value_0() {
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 5 }]
  let ordered_amount = 3
  let tx_time_gap = two_hours_in_milliseconds
  let (new_whitelisted_value, ordered_amount) =
    update_whitelisted_value(whitelisted_value, [], ordered_amount, tx_time_gap)

  and {
    new_whitelisted_value == [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 2 },
    ],
    ordered_amount == 0,
  }
}

test can_update_whitelisted_value_1() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 5 },
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 3 },
    ]
  let ordered_amount = 3
  let tx_time_gap = two_hours_in_milliseconds
  let (new_whitelisted_value, ordered_amount) =
    update_whitelisted_value(whitelisted_value, [], ordered_amount, tx_time_gap)

  and {
    new_whitelisted_value == [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 2 },
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 3 },
    ],
    ordered_amount == 0,
  }
}

test can_update_whitelisted_value_2() {
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 5 }]
  let ordered_amount = 3
  let tx_time_gap = two_hours_in_milliseconds * 2
  let (new_whitelisted_value, ordered_amount) =
    update_whitelisted_value(whitelisted_value, [], ordered_amount, tx_time_gap)

  and {
    new_whitelisted_value == [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 5 },
    ],
    ordered_amount == 3,
  }
}

test can_update_whitelisted_value_3() {
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 2 }]
  let ordered_amount = 3
  let tx_time_gap = two_hours_in_milliseconds
  let (new_whitelisted_value, ordered_amount) =
    update_whitelisted_value(whitelisted_value, [], ordered_amount, tx_time_gap)

  and {
    new_whitelisted_value == [],
    ordered_amount == 1,
  }
}

test can_update_whitelisted_value_4() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 1 },
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 3 },
    ]
  let ordered_amount = 3
  let tx_time_gap = one_hour_in_milliseconds
  let (new_whitelisted_value, ordered_amount) =
    update_whitelisted_value(whitelisted_value, [], ordered_amount, tx_time_gap)

  and {
    new_whitelisted_value == [
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 1 },
    ],
    ordered_amount == 0,
  }
}

test can_update_whitelisted_value_5() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 0 },
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 2 },
    ]
  let ordered_amount = 2
  let tx_time_gap = one_hour_in_milliseconds
  let (new_whitelisted_value, ordered_amount) =
    update_whitelisted_value(whitelisted_value, [], ordered_amount, tx_time_gap)

  and {
    new_whitelisted_value == [],
    ordered_amount == 0,
  }
}
