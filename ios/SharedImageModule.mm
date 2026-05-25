//
//  SharedImageModule.mm
//  AwesomeFinanceApp
//

#import <Foundation/Foundation.h>
#import "SharedImageModule.h"

static NSString *const kAppGroupId      = @"group.com.finance.expensify";
static NSString *const kPendingShareKey = @"hasPendingShare";
static NSString *const kActionKey       = @"pendingShareAction";
static NSString *const kParsedResultKey = @"parsedResult";
static NSString *const kGeminiApiKey    = @"geminiApiKey";
static NSString *const kImageFileName   = @"pending_share.jpg";

@implementation SharedImageModule

RCT_EXPORT_MODULE(SharedImage)

// Called once on app startup so the share extension can read the key without
// needing it bundled separately.
RCT_EXPORT_METHOD(setGeminiApiKey:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:kAppGroupId];
  if (key && key.length > 0) {
    [defaults setObject:key forKey:kGeminiApiKey];
    [defaults synchronize];
  }
  resolve(nil);
}

// Returns { path, action, parsedResult } and clears all pending-share state.
// action  — "transaction" | "split" | nil (nil → open SharedImageScreen)
// parsedResult — JSON string from Gemini, or nil if parsing wasn't done in the extension
RCT_EXPORT_METHOD(getPendingShareData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:kAppGroupId];
  BOOL hasPending = [defaults boolForKey:kPendingShareKey];

  if (!hasPending) {
    resolve(nil);
    return;
  }

  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:kAppGroupId];

  if (!containerURL) {
    resolve(nil);
    return;
  }

  NSURL *imageURL = [containerURL URLByAppendingPathComponent:kImageFileName];
  BOOL exists = [[NSFileManager defaultManager] fileExistsAtPath:imageURL.path];

  if (!exists) {
    resolve(nil);
    return;
  }

  NSString *action       = [defaults stringForKey:kActionKey];
  NSString *parsedResult = [defaults stringForKey:kParsedResultKey];

  // Clear all pending-share state atomically.
  [defaults setBool:NO forKey:kPendingShareKey];
  [defaults removeObjectForKey:kActionKey];
  [defaults removeObjectForKey:kParsedResultKey];
  [defaults synchronize];

  NSMutableDictionary *result = [NSMutableDictionary dictionary];
  result[@"path"] = imageURL.path;
  if (action)       result[@"action"]       = action;
  if (parsedResult) result[@"parsedResult"] = parsedResult;

  resolve(result);
}

// Legacy — kept so any existing call sites don't break during the transition.
RCT_EXPORT_METHOD(getPendingImagePath:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:kAppGroupId];
  BOOL hasPending = [defaults boolForKey:kPendingShareKey];

  if (!hasPending) { resolve(nil); return; }

  NSURL *containerURL = [[NSFileManager defaultManager]
    containerURLForSecurityApplicationGroupIdentifier:kAppGroupId];
  if (!containerURL) { resolve(nil); return; }

  NSURL *imageURL = [containerURL URLByAppendingPathComponent:kImageFileName];
  if ([[NSFileManager defaultManager] fileExistsAtPath:imageURL.path]) {
    [defaults setBool:NO forKey:kPendingShareKey];
    [defaults removeObjectForKey:kActionKey];
    [defaults removeObjectForKey:kParsedResultKey];
    [defaults synchronize];
    resolve(imageURL.path);
  } else {
    resolve(nil);
  }
}

@end
