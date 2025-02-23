use crate::services::appconstants::model::Appconstant;
use crate::services::appconstants::db_utils::{add_appconstant_to_database, get_all_appconstants_from_database, update_appconstant_in_database, delete_appconstant_from_database};
use std::error::Error;

pub fn add_appconstant(appconstant: Appconstant) -> Result<Appconstant, Box<dyn Error>> {
    let appconstant = add_appconstant_to_database(appconstant)?;
    Ok(appconstant)
}

pub fn get_all_appconstants() -> Result<Vec<Appconstant>, Box<dyn Error>> {
    let appconstants = get_all_appconstants_from_database()?;
    Ok(appconstants)
}

pub fn update_appconstant(appconstant: Appconstant) -> Result<Appconstant, Box<dyn Error>> {
    if let Some(_id) = appconstant.id {
        let appconstant = update_appconstant_in_database(appconstant)?;
        Ok(appconstant)
    } else {
        Err("Appconstant does not contain an id".into())
    }
    
}

pub fn delete_appconstant(appconstant: Appconstant) -> Result<(), Box<dyn Error>> {
    if let Some(id) = appconstant.id {
        delete_appconstant_from_database(id)?;
        Ok(())
    } else {
        Err("Appconstant does not contain an id".into())
    }
}
