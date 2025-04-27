use chrono::{DateTime, Duration, Utc};

use chrono::Months;
use std::error::Error;

pub fn calculate_next_date(
    date_string: &str,
    frequency: &str,
) -> Result<DateTime<Utc>, Box<dyn Error>> {
    let date: DateTime<Utc> = date_string.parse()?;

    let new_date = match frequency {
        "Every day" => date + Duration::days(1),
        "Every week" => date + Duration::days(7),
        "Every 15 days" => date + Duration::days(15),
        "Every 28 days" => date + Duration::days(28),
        "Every month" => date.checked_add_months(Months::new(1)).unwrap(),
        "Every 2 months" => date.checked_add_months(Months::new(2)).unwrap(),
        "Every 3 months" => date.checked_add_months(Months::new(3)).unwrap(),
        "Every 6 months" => date.checked_add_months(Months::new(6)).unwrap(),
        "Every year" => date.checked_add_months(Months::new(12)).unwrap(),
        _ => return Err("invalid frequency".into()),
    };

    Ok(new_date)
}
