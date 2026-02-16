type HandleCheckPermission<TResource> = (
  resource?: TResource
) => boolean;

type PermissionHandlerGenerator<TAction extends string, TResource, TAuth> = (
  action: TAction,
  req: Request
) => Promise<{
  handler: HandleCheckPermission<TResource>;
  needResource: boolean;
  authData: TAuth;
}>;

export type Guard<TAction extends string, TResource, TAuth> = {
  permissionHandlerGenerator: PermissionHandlerGenerator<TAction, TResource, TAuth>;
  action: TAction;
};

interface InitGuardOptions<TAction extends string, TResource, TAuth> {
  guardChecks: GuardCheck<TAction, TResource, TAuth>;
  auth: (req: Request) => Promise<TAuth>;
}

type ResourceBasedPermission<TAuth, TResource> = (
  auth: TAuth,
  resource: TResource
) => boolean;

type BasicPermission<TAuth> = (auth: TAuth) => boolean;

export type GuardCheck<TAction extends string, TResource, TAuth> = {
  [key in TAction]:
    | ResourceBasedPermission<TAuth, TResource>
    | BasicPermission<TAuth>;
};

export function initGuards<TAction extends string, TResource, TAuth>(
  options: InitGuardOptions<TAction, TResource, TAuth>
) {
  const _permissionHandlerGenerator: PermissionHandlerGenerator<
    TAction,
    TResource,
    TAuth
  > = async (action: TAction, req: Request) => {
    const authData = await options.auth(req);
    const permission = options.guardChecks[action];
    const needResource = permission.length === 2;
    function handler(resource?: TResource) {
      if (permission.length === 1) {
        const basicPermission = permission as BasicPermission<TAuth>;
        return basicPermission(authData);
      }
      if (permission.length === 2) {
        const resourceBasedPermission = permission as ResourceBasedPermission<
          TAuth,
          TResource
        >;
        return resourceBasedPermission(authData, resource!);
      }
      return false;
    }
    return {
      needResource,
      handler,
      authData
    };
  };

  // Build one Guard<K> per action key
  const guards = {} as { [A in TAction]: Guard<A, TResource, TAuth> };

  for (const action of Object.keys(options.guardChecks) as TAction[]) {
    guards[action] = {
      action,
      permissionHandlerGenerator: _permissionHandlerGenerator,
    } as Guard<typeof action, TResource, TAuth>;
  }

  return guards;
}
