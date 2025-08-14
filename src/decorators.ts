import { SetMetadata } from '@nestjs/common';

export const ACTION_METADATA_KEY = 'actionName';

export const LogAction = (actionName: string): MethodDecorator => {
  return SetMetadata(ACTION_METADATA_KEY, actionName);
};
