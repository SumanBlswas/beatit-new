#import "EqualizerModule.h"
#import <React/RCTLog.h>
#import <AVFoundation/AVFoundation.h>

@implementation EqualizerModule {
  AVAudioEngine *_engine;
  AVAudioUnitEQ *_eq;
}

RCT_EXPORT_MODULE(EqualizerModule);

RCT_EXPORT_METHOD(init:(nonnull NSNumber *)sessionId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (_engine) {
      [_engine stop];
      _engine = nil;
      _eq = nil;
    }

    _engine = [[AVAudioEngine alloc] init];
    AVAudioUnitEQ *eq = [[AVAudioUnitEQ alloc] initWithNumberOfBands:8];
    eq.bypass = NO;

    // Provide sensible center frequencies for 8 bands
    NSArray<NSNumber *> *freqs = @[@60,@170,@310,@600,@1000,@3000,@6000,@12000];
    for (int i = 0; i < eq.bands.count; i++) {
      AVAudioUnitEQFilterParameters *band = eq.bands[i];
      band.filterType = AVAudioUnitEQFilterTypeParametric;
      band.frequency = freqs[i].doubleValue;
      band.bandwidth = 1.0; // Q ~ 1.0
      band.gain = 0.0;
      band.bypass = NO;
    }

    _eq = eq;
    [_engine attachNode:_eq];

    AVAudioMixerNode *mainMixer = _engine.mainMixerNode;
    AVAudioNode *outputNode = _engine.outputNode;

    // Connect eq -> mainMixer -> output
    [_engine connect:_eq to:mainMixer format:nil];
    [_engine connect:mainMixer to:outputNode format:nil];

    NSError *error = nil;
    BOOL started = [_engine startAndReturnError:&error];
    if (!started) {
      RCTLogWarn(@"Equalizer start error: %@", error);
      // still return resolve to avoid hard failure
    }

    resolve(@(YES));
  }
  @catch (NSException *exception) {
    reject(@"EQUALIZER_INIT", exception.reason, nil);
  }
}

RCT_EXPORT_METHOD(setGains:(NSArray *)gains resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (!_eq) {
      reject(@"EQUALIZER_NOT_INIT", @"Equalizer not initialized", nil);
      return;
    }
    NSUInteger count = MIN(gains.count, _eq.bands.count);
    for (NSUInteger i = 0; i < count; i++) {
      NSNumber *val = gains[i];
      double db = [val doubleValue];
      AVAudioUnitEQFilterParameters *band = _eq.bands[i];
      band.gain = db;
    }
    resolve(@(YES));
  }
  @catch (NSException *exception) {
    reject(@"EQUALIZER_SET", exception.reason, nil);
  }
}

RCT_EXPORT_METHOD(setEnabled:(BOOL)enabled resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (_eq) {
      _eq.bypass = !enabled;
    }
    resolve(@(YES));
  }
  @catch (NSException *exception) {
    reject(@"EQUALIZER_ENABLE", exception.reason, nil);
  }
}

RCT_EXPORT_METHOD(release:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    if (_engine) {
      [_engine stop];
      _engine = nil;
      _eq = nil;
    }
    resolve(@(YES));
  }
  @catch (NSException *exception) {
    reject(@"EQUALIZER_RELEASE", exception.reason, nil);
  }
}
