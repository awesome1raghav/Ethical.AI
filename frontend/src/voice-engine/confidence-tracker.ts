/**
 * @fileOverview Tracks and evaluates the confidence score of the STT engine.
 */

export class ConfidenceTracker {
  private scores: number[] = [];

  public addScore(score: number): void {
    this.scores.push(score);
    // Keep only the last 10 samples for a moving average
    if (this.scores.length > 10) {
      this.scores.shift();
    }
  }

  public getAverageConfidence(): number {
    if (this.scores.length === 0) return 0;
    const sum = this.scores.reduce((a, b) => a + b, 0);
    return parseFloat((sum / this.scores.length).toFixed(2));
  }

  public reset(): void {
    this.scores = [];
  }
}
