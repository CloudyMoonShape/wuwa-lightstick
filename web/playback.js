/** Serial ownership of firmware effects and browser streaming. No firmware code. */
export class DevicePlayback {
  constructor({ client, sender, canStream = () => true, onMode = () => {}, onError = () => {} }) {
    Object.assign(this, { client, sender, canStream, onMode, onError });
    this.epoch = 0; this.revision = 0; this.appliedRevision = 0;
    this.mode = 'unknown'; this.key = null; this.target = null; this.task = null;
  }
  reset() {
    this.sender.stop(); this.epoch++; this.revision++;
    this.appliedRevision = this.revision;
    this.mode = 'unknown'; this.key = null; this.target = null;
  }
  configure(target) {
    this.target = { ...target, rgb: target.rgb?.slice() };
    this.revision++; this.sender.stop();
    if (!this.task && this.client.ready) {
      const epoch = this.epoch;
      this.task = this._apply(epoch).catch(error => {
        if (epoch !== this.epoch) return;
        this.sender.stop(); this.mode = 'unknown'; this.key = null;
        this.appliedRevision = this.revision;
        this.onError(error);
      }).finally(() => {
        this.task = null;
        if (this.target && this.client.ready && this.appliedRevision !== this.revision) this.configure(this.target);
      });
    }
    return this.task ?? Promise.resolve();
  }
  async _apply(epoch) {
    while (this.client.ready && this.target && this.appliedRevision !== this.revision) {
      const target = this.target, revision = this.revision;
      const key = `${target.kind}:${target.intervalMs ?? ''}:${!!target.continuous}`;
      if (key !== this.key || target.forceReset) {
        let sent = true;
        if (target.kind === 'stream') {
          if (target.continuous || this.mode !== 'unknown' || target.forceReset) sent = await this.client.stopNativeEffect();
        } else {
          sent = await this.client.setNativeEffect(target.kind, target);
        }
        if (epoch !== this.epoch) return;
        if (!sent) throw new Error('Mode command was superseded; choose the effect again');
        this.mode = target.kind; this.key = key;
        this.sender.invalidate();
      }
      this.appliedRevision = revision;
      if (revision === this.revision) {
        this.onMode(this.mode);
        this.resume();
      }
    }
  }
  resume() {
    if (this.client.ready && this.canStream() && this.appliedRevision === this.revision &&
      ['stream', 'breathe', 'blink'].includes(this.mode)) this.sender.start();
    else this.sender.stop();
  }
  sendColor(rgb) {
    // In native custom-color effects, 0x01 updates the base without restarting phase.
    return this.mode === 'stream' && this.target?.continuous
      ? this.client.setContinuousColor(rgb) : this.client.setColor(rgb);
  }
}
