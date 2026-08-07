import { simplifyError } from './handle-error.simplify';

export function HandleError(customMessage?: string, record?: string) {
  return function (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    if (!method) return;

    descriptor.value = async function (...args: any[]): Promise<any> {
      try {
        return await method.apply(this, args);
      } catch (error) {
        simplifyError(error as Error, customMessage, record);
      }
    };
  };
}
