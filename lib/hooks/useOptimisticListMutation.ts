"use client";

// Generic optimistic-update helpers for tRPC list-query mutations.
//
// Returns the { onMutate, onError, onSettled } trio you spread into a
// useMutation options bag. Captures the pre-mutation cache snapshot,
// applies the caller's patch to the optimistic view, rolls back on
// error, and invalidates on settle so the server result reconciles.
//
// Generic over the input shape (TInput) and the cached list item
// (TItem). Phase 9 reuses this for people.* and contracts.* mutations.
//
// The `util` parameter is duck-typed against any tRPC v11 list-query
// utility: cancel / getData / setData / invalidate. Keeping it
// structural avoids dragging tRPC's deep internal types into every
// call site.

type ListUtilLike<T> = {
  cancel: () => Promise<unknown>;
  getData: () => T[] | undefined;
  setData: (
    input: undefined,
    updater: T[] | ((old: T[] | undefined) => T[] | undefined),
  ) => unknown;
  invalidate: () => Promise<unknown>;
};

type OptimisticContext<TItem> = { previous: TItem[] | undefined };

export function useOptimisticListMutation<TInput, TItem>(
  util: ListUtilLike<TItem>,
  patch: (old: TItem[], input: TInput) => TItem[],
) {
  return {
    onMutate: async (input: TInput): Promise<OptimisticContext<TItem>> => {
      // Cancel any in-flight refetch so it doesn't overwrite our patch.
      await util.cancel();
      const previous = util.getData();
      util.setData(undefined, (old) => (old ? patch(old, input) : old));
      return { previous };
    },
    onError: (
      _err: unknown,
      _input: TInput,
      ctx: OptimisticContext<TItem> | undefined,
    ) => {
      if (ctx?.previous) util.setData(undefined, ctx.previous);
    },
    onSettled: () => {
      void util.invalidate();
    },
  };
}
