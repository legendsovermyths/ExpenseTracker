/// How much `other` owes `me` for a single entry, given every participant's
/// `amount_cents` (paid − owed). Positive ⇒ other owes me.
///
/// Debtors owe creditors in proportion to each creditor's share of the total
/// credit. Two-person entries use `me`'s amount verbatim, matching the
/// server's `balance_pair` view (some legacy rows are off by a rounding cent).
pub fn pairwise_net(items: &[(String, i64)], me: &str, other: &str) -> i64 {
    let a_me = match items.iter().find(|(u, _)| u == me) {
        Some((_, a)) => *a,
        None => return 0,
    };
    let a_other = match items.iter().find(|(u, _)| u == other) {
        Some((_, a)) => *a,
        None => return 0,
    };
    if items.len() == 2 {
        return a_me;
    }
    let credit: i64 = items.iter().filter(|(_, a)| *a > 0).map(|(_, a)| *a).sum();
    if credit == 0 {
        return 0;
    }
    let v = if a_me > 0 && a_other < 0 {
        (-a_other) as f64 * a_me as f64 / credit as f64
    } else if a_me < 0 && a_other > 0 {
        a_me as f64 * a_other as f64 / credit as f64
    } else {
        0.0
    };
    v.round() as i64
}

#[cfg(test)]
mod tests {
    use super::pairwise_net;

    fn items(v: &[(&str, i64)]) -> Vec<(String, i64)> {
        v.iter().map(|(u, a)| (u.to_string(), *a)).collect()
    }

    #[test]
    fn two_person_uses_my_amount() {
        let it = items(&[("a", 3192), ("b", -3193)]);
        assert_eq!(pairwise_net(&it, "a", "b"), 3192);
        assert_eq!(pairwise_net(&it, "b", "a"), -3193);
    }

    #[test]
    fn three_way_equal_split() {
        // a paid 300 for a, b, c
        let it = items(&[("a", 20000), ("b", -10000), ("c", -10000)]);
        assert_eq!(pairwise_net(&it, "a", "b"), 10000);
        assert_eq!(pairwise_net(&it, "b", "a"), -10000);
        assert_eq!(pairwise_net(&it, "b", "c"), 0);
    }

    #[test]
    fn multiple_payers_proportional() {
        // a +300, b +100, c -400 → c owes a 300, b 100
        let it = items(&[("a", 30000), ("b", 10000), ("c", -40000)]);
        assert_eq!(pairwise_net(&it, "a", "c"), 30000);
        assert_eq!(pairwise_net(&it, "b", "c"), 10000);
        assert_eq!(pairwise_net(&it, "c", "b"), -10000);
        assert_eq!(pairwise_net(&it, "a", "b"), 0);
    }

    #[test]
    fn missing_participant_is_zero() {
        let it = items(&[("a", 100), ("b", -50), ("c", -50)]);
        assert_eq!(pairwise_net(&it, "a", "z"), 0);
    }
}
