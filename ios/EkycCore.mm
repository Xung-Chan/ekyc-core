#import "EkycCore.h"
#import <React/RCTUtils.h>

@interface EkycCore ()
@property (nonatomic, copy) RCTPromiseResolveBlock ekycResolve;
@property (nonatomic, copy) RCTPromiseRejectBlock ekycReject;
@end

@implementation EkycCore

// MARK: - Constants
static NSString *const NAME = @"EkycCore";
static NSString *const TOKEN_ID = @"4fcae791-b633-114b-e063-63199f0a42f2";
static NSString *const TOKEN_KEY = @"MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAJokjhVVcmxoJ7qtctER6UIMjy/YkHL6DGndw9F6J2OtB71G/dibYkcDBlJHBTBEqWUTc1g3sw3x/QsxkhnxFGECAwEAAQ==";
static NSString *const ACCESS_TOKEN = @"bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0cmFuc2FjdGlvbl9pZCI6IjZmMDAyYTk1LTM1NzQtNGQ0NC1iYjQwLTQ4ZjhmYzlkYWRkNiIsInN1YiI6IjRmY2FlMzdmLTZlNGYtNTI5Ni1lMDYzLTYyMTk5ZjBhNTUxMCIsImF1ZCI6WyJyZXN0c2VydmljZSJdLCJ1c2VyX25hbWUiOiJ2aWZvY2kxOTg3QHRhdGVmYXJtLmNvbSIsInNjb3BlIjpbInJlYWQiXSwiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3QiLCJuYW1lIjoidmlmb2NpMTk4N0B0YXRlZmFybS5jb20iLCJleHAiOjE3NzY2MDczMTQsInV1aWRfYWNjb3VudCI6IjRmY2FlMzdmLTZlNGYtNTI5Ni1lMDYzLTYyMTk5ZjBhNTUxMCIsImF1dGhvcml0aWVzIjpbIlVTRVIiXSwianRpIjoiMGQ0ZGQ3YmMtZTQ3Ny00Njk4LTg5NDMtNDMxZDcxZjk5OWFlIiwiY2xpZW50X2lkIjoiOF9ob3VyIn0.Nj1uXH1rLBPlKl_WtaVmo8JHn8Agrk578IgNJTw5Ls5eW2FqpN07r5jlqM-DyxiJozlF0D5NSw3a71tfuiWttcqr-p-0l2QWBJhB4MVfFPQNBhnPdCeB07bGbHxO7aDK7nSXb01ml_ioQHe3fJ-7ZsMl7h5PKhBbv1lW9UhUpamIkhRLse5cezpDtHqDWYhpl6vJedgQG4b00BC50PwS1vzi-1lsgNYkzx3RlicSQwjtdNtornmP5RX5hmWAkLdzz6niazf1RbEgoIwMwIS-6MdKcM_t5UTdkkuxzrfpXv2W-cj4h5k9g20Dg1sx5TLSvDB-KFkFvsmu841B9e5LjQ";

// MARK: - NativeEkycCoreSpec Implementation

- (void)startEkyc:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    self.ekycResolve = resolve;
    self.ekycReject = reject;

    dispatch_async(dispatch_get_main_queue(), ^{
        UIViewController *rootViewController = RCTPresentedViewController();
        if (!rootViewController) {
            NSLog(@"[%@] Top ViewController is not available", NAME);
            if (self.ekycReject) {
                self.ekycReject(@"NO_ACTIVITY", @"ViewController is not available. Please ensure the app is in the foreground and try again.", nil);
                self.ekycReject = nil;
                self.ekycResolve = nil;
            }
            return;
        }

        @try {
            NSLog(@"[%@] Starting eKYC flow on iOS", NAME);

            /*
             * CẤU HÌNH SDK VNPT IDENTITY CHO IOS (tương đương createFullEkycIntent trên Android):
             *
             * Khi bạn kéo framework SDK VNPT vào Xcode/CocoaPods, cấu hình tương đương sẽ như sau:
             *
             * VNPTIdentityConfig *config = [[VNPTIdentityConfig alloc] init];
             * config.accessToken = ACCESS_TOKEN;
             * config.tokenId = TOKEN_ID;
             * config.tokenKey = TOKEN_KEY;
             * config.documentType = VNPTDocumentTypeIdentityCard;
             * config.versionSdk = VNPTVersionSDKAdvanced;
             * config.isShowTutorial = YES;
             * config.isEnableGotIt = YES;
             * config.isEnableCompare = YES;
             * config.checkLivenessFace = VNPTModeCheckLivenessFaceIBETA;
             * config.isCheckMaskedFace = YES;
             * config.isCheckLivenessCard = YES;
             * config.isValidatePostcode = YES;
             * config.validateDocumentType = VNPTValidateDocumentTypeBasic;
             * config.languageSdk = VNPTLanguageVietnamese;
             * config.isEnableScanQRCode = YES;
             *
             * VNPTIdentityViewController *ekycVC = [[VNPTIdentityViewController alloc] initWithConfig:config];
             * ekycVC.delegate = self; // Xử lý kết quả trả về
             * [rootViewController presentViewController:ekycVC animated:YES completion:nil];
             */

            // Mô phỏng callback trả về kết quả cấu trúc VerifyCccdResult { message: NSString }
            // (Khi tích hợp framework thực tế, đoạn này sẽ được gọi trong delegate của VNPT SDK)
            NSLog(@"[%@] eKYC started successfully", NAME);
        }
        @catch (NSException *exception) {
            NSLog(@"[%@] Failed to start eKYC: %@", NAME, exception.reason);
            if (self.ekycReject) {
                self.ekycReject(@"EKYC_START_FAILED", [NSString stringWithFormat:@"Failed to start eKYC: %@", exception.reason], nil);
                self.ekycReject = nil;
                self.ekycResolve = nil;
            }
        }
    });
}

- (void)getResult:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {
    self.ekycResolve = resolve;
    self.ekycReject = reject;
    NSLog(@"[%@] getResult: Promise registered", NAME);
}

// MARK: - Result Handlers (Gọi khi SDK trả về kết quả / delegate)

- (void)handleEkycSuccessWithResult:(NSString *)resultString {
    if (self.ekycResolve) {
        NSDictionary *resultMap = @{
            @"message": resultString ?: @""
        };
        self.ekycResolve(resultMap);
        self.ekycResolve = nil;
        self.ekycReject = nil;
    }
}

- (void)handleEkycFailure:(NSString *)errorMessage {
    if (self.ekycReject) {
        self.ekycReject(@"EKYC_FAILED", errorMessage ?: @"User cancelled or failed", nil);
        self.ekycResolve = nil;
        self.ekycReject = nil;
    }
}

// MARK: - TurboModule Boilerplate

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeEkycCoreSpecJSI>(params);
}

+ (NSString *)moduleName
{
  return NAME;
}

@end

