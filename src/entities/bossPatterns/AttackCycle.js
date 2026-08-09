// Small looping state machine driving a boss attack pattern: an ordered list
// of named states, each with a duration, looping back to index 0 after the
// last one. Derives its own dt from consecutive update(time) calls so the
// caller only needs to pass the same `time` value Boss.js already gives
// pattern.update(time) -- no signature changes needed anywhere upstream.
export default class AttackCycle {
  // states: [{ name, durationMs, onEnter?(cycle), onTick?(time, dt, cycle), onExit?(cycle) }]
  constructor(states) {
    this.states = states;
    this.index = 0;
    this.current = states[0];
    this.stateStartTime = null;
    this._lastTime = null;
  }

  update(time) {
    if (this.stateStartTime === null) {
      this.stateStartTime = time;
      this._lastTime = time;
      if (this.current.onEnter) this.current.onEnter(this);
    }
    const dt = time - this._lastTime;
    this._lastTime = time;

    if (this.current.onTick) this.current.onTick(time, dt, this);

    if (time - this.stateStartTime >= this.current.durationMs) {
      if (this.current.onExit) this.current.onExit(this);
      this.index = (this.index + 1) % this.states.length;
      this.current = this.states[this.index];
      this.stateStartTime = time;
      this._lastTime = time;
      if (this.current.onEnter) this.current.onEnter(this);
    }
  }

  // Restarts at state 0. Pass a new states array when swapping in a
  // different phase's cycle (Mission 2); omit it to just rewind.
  reset(states) {
    if (this.current && this.current.onExit) this.current.onExit(this);
    if (states) this.states = states;
    this.index = 0;
    this.current = this.states[0];
    this.stateStartTime = null;
    this._lastTime = null;
  }

  destroy() {
    if (this.current && this.current.onExit) this.current.onExit(this);
  }
}
