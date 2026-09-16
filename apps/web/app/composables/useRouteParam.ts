import * as v from 'valibot';

const routeParamSchema = v.union([v.string(), v.array(v.string()), v.undefined()]);

export function useRouteParam(name: string): Readonly<Ref<string>> {
  const route = useRoute();
  return computed(() => {
    // SAFETY: typed pages union params by route; this helper reads any path param by name.
    const params = route.params as Record<string, string | string[] | undefined>;
    const result = v.safeParse(routeParamSchema, params[name]);
    if (!result.success) {
      return '';
    }
    if (Array.isArray(result.output)) {
      return result.output[0] ?? '';
    }
    return result.output ?? '';
  });
}
