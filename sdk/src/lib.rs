pub mod api;
pub mod services;
pub mod transaction;
pub mod account;
pub mod category;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn invoke_request(input: *const c_char) -> *mut c_char {
    let input_str = unsafe { 
        CStr::from_ptr(input)
            .to_str()
            .unwrap_or("") 
    };

    let response = api::handle_request(input_str);
    CString::new(response).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn free_response(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }
    unsafe {
        CString::from_raw(ptr); // Reclaim memory allocated for the response
    }
}

#[no_mangle]
pub unsafe extern fn hello_world() -> *const c_char {
    let s = CString::new("Hello World!").expect("CString_failed");
    s.into_raw()
}

