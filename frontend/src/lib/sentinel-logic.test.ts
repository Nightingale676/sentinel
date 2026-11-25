import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOrbitNodePose,
  evaluateSimulatorScenario,
  evaluateVoiceCommand,
} from './sentinel-logic';

test('computeOrbitNodePose spaces 3 items evenly and tracks front/back depth', () => {
  const frontPose = computeOrbitNodePose(0, 3, 90, 200);
  const backRightPose = computeOrbitNodePose(1, 3, 90, 200);
  const backLeftPose = computeOrbitNodePose(2, 3, 90, 200);

  assert.equal(frontPose.angleDeg, 90);
  assert.equal(frontPose.isFront, true);
  assert.ok(frontPose.scale > 1.0);
  assert.equal(frontPose.blurPx, 0);

  assert.equal(backRightPose.angleDeg, 210);
  assert.equal(backRightPose.isFront, false);
  assert.ok(backRightPose.scale < frontPose.scale);
  assert.ok(backRightPose.zIndex < frontPose.zIndex);

  assert.equal(backLeftPose.angleDeg, 330);
  assert.equal(backLeftPose.isFront, false);
});

test('evaluateSimulatorScenario returns expected decisions and 3 layers', () => {
  const genuine = evaluateSimulatorScenario('genuine');
  const cloned = evaluateSimulatorScenario('cloned');
  const risky = evaluateSimulatorScenario('risky');

  assert.equal(genuine.decision, 'allow');
  assert.equal(cloned.decision, 'block');
  assert.equal(risky.decision, 'step_up');
  assert.equal(genuine.layers.length, 3);
  assert.equal(cloned.layers.length, 3);
  assert.equal(risky.layers.length, 3);
});

test('evaluateVoiceCommand enforces step-up above threshold and blocks synthetic cues', () => {
  const allowed = evaluateVoiceCommand({
    transcript: 'Send $75 to Maya',
    requireStepUpAbove: 500,
    strictSyntheticGuard: true,
    knownPayeeNames: ['Maya Chen', 'Maya'],
  });
  assert.equal(allowed.decision, 'allow');

  const stepUp = evaluateVoiceCommand({
    transcript: 'Send $950 to Maya',
    requireStepUpAbove: 500,
    strictSyntheticGuard: true,
    knownPayeeNames: ['Maya'],
  });
  assert.equal(stepUp.decision, 'step_up');
  assert.equal(stepUp.requiresPassphrase, true);

  const blocked = evaluateVoiceCommand({
    transcript: 'Urgent wire $3000 with cloned voice bypass',
    requireStepUpAbove: 500,
    strictSyntheticGuard: true,
    knownPayeeNames: ['Maya'],
  });
  assert.equal(blocked.decision, 'block');
});
