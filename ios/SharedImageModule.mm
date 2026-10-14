//
//  SharedImageModule.mm
//  AwesomeFinanceApp
//

#import <Foundation/Foundation.h>
#import "SharedImageModule.h"

static NSString *const kAppGroupId      = @"group.com.finance.expensify";
static NSString *const kPendingShareKey = @"hasPendingShare";
static NSString *const kActionKey       = @"pendingShareAction";
static NSString *const kCountKey        = @"pendingShareCount";
static NSString *const kParsedResultKey = @"parsedResult";
static NSString *const kImageFileName   = @"pending_share.jpg";

@implementation SharedImageModule

RCT_EXPORT_MODULE(SharedImage)

// Returns { paths, path, action } and clears pending-share state.
// paths   — array of image file paths (multi-image share), order preserved
// path    — paths[0], kept as a legacy alias
// action  — "transaction" | "split" | nil (nil → open SharedImageScreen)
// NOTE: the image files themselves are NOT deleted here — RN reads them after
// this resolves. They're overwritten by the next share.
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

  NSFileManager *fm = [NSFileManager defaultManager];
  NSInteger count = [defaults integerForKey:kCountKey];
  NSMutableArray<NSString *> *paths = [NSMutableArray array];

  if (count > 0) {
    for (NSInteger i = 0; i < count; i++) {
      NSString *name = [NSString stringWithFormat:@"pending_share_%ld.jpg", (long)i];
      NSURL *url = [containerURL URLByAppendingPathComponent:name];
      if ([fm fileExistsAtPath:url.path]) {
        [paths addObject:url.path];
      }
    }
  } else {
    // Legacy single-file fallback.
    NSURL *url = [containerURL URLByAppendingPathComponent:kImageFileName];
    if ([fm fileExistsAtPath:url.path]) {
      [paths addObject:url.path];
    }
  }

  if (paths.count == 0) {
    resolve(nil);
    return;
  }

  NSString *action = [defaults stringForKey:kActionKey];

  // Clear pending-share flags atomically (files are left for RN to read).
  [defaults setBool:NO forKey:kPendingShareKey];
  [defaults removeObjectForKey:kActionKey];
  [defaults removeObjectForKey:kCountKey];
  [defaults removeObjectForKey:kParsedResultKey];
  [defaults synchronize];

  NSMutableDictionary *result = [NSMutableDictionary dictionary];
  result[@"paths"] = paths;
  result[@"path"]  = paths[0];   // legacy alias
  if (action) result[@"action"] = action;

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
