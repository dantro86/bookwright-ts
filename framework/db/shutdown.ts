import { InfrastructureError, ShutdownError } from './errors.ts';

export interface ShutdownStep {
  readonly name: string;
  readonly close: () => Promise<void>;
}

/**
 * Closes resources strictly in the given order, continuing after failures so later resources are
 * still released, then reports every failure at once.
 */
export async function shutdownInOrder(
  steps: readonly ShutdownStep[],
  onStep: (name: string) => void = () => undefined,
): Promise<void> {
  const failures: InfrastructureError[] = [];
  for (const step of steps) {
    onStep(step.name);
    try {
      await step.close();
    } catch (error) {
      failures.push(new InfrastructureError(`close ${step.name}`, error));
    }
  }
  if (failures.length > 0) {
    throw new ShutdownError(failures);
  }
}
