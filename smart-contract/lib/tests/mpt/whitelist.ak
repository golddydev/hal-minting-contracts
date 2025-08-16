use hal_nft_mint/whitelist.{WhitelistedItem, WhitelistedValue}
use tests/mocks/fake_constants.{
  one_hour_in_milliseconds, two_hours_in_milliseconds, whitelisted_price_1,
  whitelisted_price_2,
}
use validations/minting_data/utils.{update_whitelisted_value}

test can_update_whitelisted_value_0() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 5,
        price: whitelisted_price_1,
      },
    ]
  let ordered_amount = 3
  let tx_time_gap = two_hours_in_milliseconds
  let (
    new_whitelisted_value,
    remaining_ordered_amount,
    spent_lovelace_for_whitelisted,
  ) =
    update_whitelisted_value(
      whitelisted_value,
      [],
      ordered_amount,
      0,
      tx_time_gap,
    )

  expect
    new_whitelisted_value == [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 2,
        price: whitelisted_price_1,
      },
    ]
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_1 * 3
  True
}

test can_update_whitelisted_value_1() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 5,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 3,
        price: whitelisted_price_2,
      },
    ]
  let ordered_amount = 3
  let tx_time_gap = two_hours_in_milliseconds
  let (
    new_whitelisted_value,
    remaining_ordered_amount,
    spent_lovelace_for_whitelisted,
  ) =
    update_whitelisted_value(
      whitelisted_value,
      [],
      ordered_amount,
      0,
      tx_time_gap,
    )

  expect
    new_whitelisted_value == [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 2,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 3,
        price: whitelisted_price_2,
      },
    ]
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_1 * 3
  True
}

test can_update_whitelisted_value_2() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 5,
        price: whitelisted_price_1,
      },
    ]
  let ordered_amount = 3
  let tx_time_gap = two_hours_in_milliseconds * 2
  let (
    new_whitelisted_value,
    remaining_ordered_amount,
    spent_lovelace_for_whitelisted,
  ) =
    update_whitelisted_value(
      whitelisted_value,
      [],
      ordered_amount,
      0,
      tx_time_gap,
    )

  expect
    new_whitelisted_value == [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 5,
        price: whitelisted_price_1,
      },
    ]
  expect remaining_ordered_amount == 3
  expect spent_lovelace_for_whitelisted == 0
  True
}

test can_update_whitelisted_value_3() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 2,
        price: whitelisted_price_1,
      },
    ]
  let ordered_amount = 3
  let tx_time_gap = two_hours_in_milliseconds
  let (
    new_whitelisted_value,
    remaining_ordered_amount,
    spent_lovelace_for_whitelisted,
  ) =
    update_whitelisted_value(
      whitelisted_value,
      [],
      ordered_amount,
      0,
      tx_time_gap,
    )

  expect new_whitelisted_value == []
  expect remaining_ordered_amount == 1
  expect spent_lovelace_for_whitelisted == whitelisted_price_1 * 2
  True
}

test can_update_whitelisted_value_4() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 1,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 3,
        price: whitelisted_price_2,
      },
    ]
  let ordered_amount = 3
  let tx_time_gap = one_hour_in_milliseconds
  let (
    new_whitelisted_value,
    remaining_ordered_amount,
    spent_lovelace_for_whitelisted,
  ) =
    update_whitelisted_value(
      whitelisted_value,
      [],
      ordered_amount,
      0,
      tx_time_gap,
    )

  expect
    new_whitelisted_value == [
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 1,
        price: whitelisted_price_2,
      },
    ]
  expect remaining_ordered_amount == 0
  expect
    spent_lovelace_for_whitelisted == whitelisted_price_1 * 1 + whitelisted_price_2 * 2
  True
}

test can_update_whitelisted_value_5() {
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 0,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 2,
        price: whitelisted_price_2,
      },
    ]
  let ordered_amount = 2
  let tx_time_gap = one_hour_in_milliseconds
  let (
    new_whitelisted_value,
    remaining_ordered_amount,
    spent_lovelace_for_whitelisted,
  ) =
    update_whitelisted_value(
      whitelisted_value,
      [],
      ordered_amount,
      0,
      tx_time_gap,
    )

  expect new_whitelisted_value == []
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_2 * 2
  True
}
