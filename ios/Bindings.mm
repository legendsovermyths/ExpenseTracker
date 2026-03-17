//
//  Bindings.mm
//  AwesomeFinanceApp
//
//  Created by Anirudh on 23/12/24.
//

#import <Foundation/Foundation.h>
#import <React/RCTLog.h>
#import "Bindings.h"
#import <sdk.h>

@implementation Bindings

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(init:(NSString *)apiKey resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  RCTLogInfo(@"Received apikey %@, calling rust next", apiKey);

  const char *myRustString = hello_world();
  if (myRustString) {
    NSString *myObjCStr = [NSString stringWithUTF8String:myRustString];
    RCTLogInfo(@"Received string: %@", myObjCStr);
    resolve(myObjCStr);
  } else {
    NSError *error = [NSError errorWithDomain:@"rust"
                                         code:500
                                     userInfo:@{NSLocalizedDescriptionKey: @"Failed to get string from Rust"}];
    reject(@"no_string", @"Rust function returned null", error);
  }
}
RCT_EXPORT_METHOD(sendRequest:(NSString *)requestJson resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  RCTLogInfo(@"Received JSON request: %@", requestJson);

  // Convert the NSString to a C string
  const char *requestCString = [requestJson UTF8String];

  // Call the Rust function
  const char *responseCString = invoke_request(requestCString);

  if (responseCString) {
    // Convert the C string response to an NSString
    NSString *responseJson = [NSString stringWithUTF8String:responseCString];
    RCTLogInfo(@"Received response: %@", responseJson);

    // Free the Rust-allocated string
    free_response((char *)responseCString);

    // Resolve the promise with the Rust response
    resolve(responseJson);
  } else {
    // Handle null response from Rust
    NSError *error = [NSError errorWithDomain:@"rust"
                                         code:500
                                     userInfo:@{NSLocalizedDescriptionKey: @"Failed to get response from Rust"}];
    reject(@"no_response", @"Rust function returned null", error);
  }
}
@end

