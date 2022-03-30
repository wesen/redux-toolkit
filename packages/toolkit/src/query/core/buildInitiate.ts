import type {
  EndpointDefinitions,
  QueryDefinition,
  MutationDefinition,
  QueryArgFrom,
  ResultTypeFrom,
} from '../endpointDefinitions'
import { DefinitionType } from '../endpointDefinitions'
import type { QueryThunk, MutationThunk } from './buildThunks'
import type { AnyAction, ThunkAction, SerializedError } from '@reduxjs/toolkit'
import type { SubscriptionOptions, RootState } from './apiState'
import type { InternalSerializeQueryArgs } from '../defaultSerializeQueryArgs'
import type { Api, ApiContext } from '../apiTypes'
import type { ApiEndpointQuery } from './module'
import type { BaseQueryError } from '../baseQueryTypes'
import type { QueryResultSelectorResult } from './buildSelectors'

declare module './module' {
  export interface ApiEndpointQuery<
    Definition extends QueryDefinition<any, any, any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Definitions extends EndpointDefinitions
  > {
    initiate: StartQueryActionCreator<Definition>
  }

  export interface ApiEndpointMutation<
    Definition extends MutationDefinition<any, any, any, any, any>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Definitions extends EndpointDefinitions
  > {
    initiate: StartMutationActionCreator<Definition>
  }
}

export interface StartQueryActionCreatorOptions {
  subscribe?: boolean
  forceRefetch?: boolean | number
  subscriptionOptions?: SubscriptionOptions
}

type StartQueryActionCreator<
  D extends QueryDefinition<any, any, any, any, any>
> = (
  arg: QueryArgFrom<D>,
  options?: StartQueryActionCreatorOptions
) => ThunkAction<QueryActionCreatorResult<D>, any, any, AnyAction>

export type QueryActionCreatorResult<
  D extends QueryDefinition<any, any, any, any>
> = Promise<QueryResultSelectorResult<D>> & {
  arg: QueryArgFrom<D>
  requestId: string
  subscriptionOptions: SubscriptionOptions | undefined
  abort(): void
  unwrap(): Promise<ResultTypeFrom<D>>
  unsubscribe(): void
  refetch(): void
  updateSubscriptionOptions(options: SubscriptionOptions): void
  queryCacheKey: string
}

type StartMutationActionCreator<
  D extends MutationDefinition<any, any, any, any>
> = (
  arg: QueryArgFrom<D>,
  options?: {
    /**
     * If this mutation should be tracked in the store.
     * If you just want to manually trigger this mutation using `dispatch` and don't care about the
     * result, state & potential errors being held in store, you can set this to false.
     * (defaults to `true`)
     */
    track?: boolean
    fixedCacheKey?: string
  }
) => ThunkAction<MutationActionCreatorResult<D>, any, any, AnyAction>

export type MutationActionCreatorResult<
  D extends MutationDefinition<any, any, any, any>
> = Promise<
  | { data: ResultTypeFrom<D> }
  | {
      error:
        | Exclude<
            BaseQueryError<
              D extends MutationDefinition<any, infer BaseQuery, any, any>
                ? BaseQuery
                : never
            >,
            undefined
          >
        | SerializedError
    }
> & {
  /** @internal */
  arg: {
    /**
     * The name of the given endpoint for the mutation
     */
    endpointName: string
    /**
     * The original arguments supplied to the mutation call
     */
    originalArgs: QueryArgFrom<D>
    /**
     * Whether the mutation is being tracked in the store.
     */
    track?: boolean
    fixedCacheKey?: string
  }
  /**
   * A unique string generated for the request sequence
   */
  requestId: string

  /**
   * A method to cancel the mutation promise. Note that this is not intended to prevent the mutation
   * that was fired off from reaching the server, but only to assist in handling the response.
   *
   * Calling `abort()` prior to the promise resolving will force it to reach the error state with
   * the serialized error:
   * `{ name: 'AbortError', message: 'Aborted' }`
   *
   * @example
   * ```ts
   * const [updateUser] = useUpdateUserMutation();
   *
   * useEffect(() => {
   *   const promise = updateUser(id);
   *   promise
   *     .unwrap()
   *     .catch((err) => {
   *       if (err.name === 'AbortError') return;
   *       // else handle the unexpected error
   *     })
   *
   *   return () => {
   *     promise.abort();
   *   }
   * }, [id, updateUser])
   * ```
   */
  abort(): void
  /**
   * Unwraps a mutation call to provide the raw response/error.
   *
   * @remarks
   * If you need to access the error or success payload immediately after a mutation, you can chain .unwrap().
   *
   * @example
   * ```ts
   * // codeblock-meta title="Using .unwrap"
   * addPost({ id: 1, name: 'Example' })
   *   .unwrap()
   *   .then((payload) => console.log('fulfilled', payload))
   *   .catch((error) => console.error('rejected', error));
   * ```
   *
   * @example
   * ```ts
   * // codeblock-meta title="Using .unwrap with async await"
   * try {
   *   const payload = await addPost({ id: 1, name: 'Example' }).unwrap();
   *   console.log('fulfilled', payload)
   * } catch (error) {
   *   console.error('rejected', error);
   * }
   * ```
   */
  unwrap(): Promise<ResultTypeFrom<D>>
  /**
   * A method to manually unsubscribe from the mutation call, meaning it will be removed from cache after the usual caching grace period.
   The value returned by the hook will reset to `isUninitialized` afterwards.
   */
  reset(): void
  /** @deprecated has been renamed to `reset` */
  unsubscribe(): void
}

export function buildInitiate({
  serializeQueryArgs,
  queryThunk,
  mutationThunk,
  api,
  context,
}: {
  serializeQueryArgs: InternalSerializeQueryArgs
  queryThunk: QueryThunk
  mutationThunk: MutationThunk
  api: Api<any, EndpointDefinitions, any, any>
  context: ApiContext<EndpointDefinitions>
}) {
  // keep track of running queries by id
  const runningQueries: Record<
    string,
    Record<string, QueryActionCreatorResult<any>>
  > = {}
  // keep track of running mutations by id
  const runningMutations: Record<
    string,
    MutationActionCreatorResult<any> | undefined
  > = {}

  const {
    unsubscribeQueryResult,
    removeMutationResult,
    updateSubscriptionOptions,
  } = api.internalActions
  return {
    buildInitiateQuery,
    buildInitiateMutation,
    getRunningOperationPromises,
    getRunningOperationPromise,
  }

  function getRunningOperationPromise(
    endpointName: string,
    argOrRequestId: any
  ): any {
    const endpointDefinition = context.endpointDefinitions[endpointName]
    if (endpointDefinition.type === DefinitionType.query) {
      const queryCacheKey = serializeQueryArgs({
        queryArgs: argOrRequestId,
        endpointDefinition,
        endpointName,
      })
      // TODO(manuel) this is not really what we want, because we don't know which of those thunks will actually resolve to the correct result
      return Promise.all(
        Object.values(runningQueries[queryCacheKey] || {})
      ).then((x) => x[0])
    } else {
      return runningMutations[argOrRequestId]
    }
  }

  function getRunningOperationPromises() {
    return [
      ...Object.values(runningQueries)
        .map((x) => Object.values(x))
        .reduce((x, y) => x.concat(y)),
      ...Object.values(runningMutations),
    ].filter(<T>(t: T | undefined): t is T => !!t)
  }

  function middlewareWarning(getState: () => RootState<{}, string, string>) {
    if (process.env.NODE_ENV !== 'production') {
      if ((middlewareWarning as any).triggered) return
      const registered =
        getState()[api.reducerPath]?.config?.middlewareRegistered
      if (registered !== undefined) {
        ;(middlewareWarning as any).triggered = true
      }
      if (registered === false) {
        console.warn(
          `Warning: Middleware for RTK-Query API at reducerPath "${api.reducerPath}" has not been added to the store.
Features like automatic cache collection, automatic refetching etc. will not be available.`
        )
      }
    }
  }

  function buildInitiateQuery(
    endpointName: string,
    endpointDefinition: QueryDefinition<any, any, any, any>
  ) {
    const queryAction: StartQueryActionCreator<any> =
      (arg, { subscribe = true, forceRefetch, subscriptionOptions } = {}) =>
      (dispatch, getState) => {
        const queryCacheKey = serializeQueryArgs({
          queryArgs: arg,
          endpointDefinition,
          endpointName,
        })
        const thunk = queryThunk({
          type: 'query',
          subscribe,
          forceRefetch,
          subscriptionOptions,
          endpointName,
          originalArgs: arg,
          queryCacheKey,
        })
        const thunkResult = dispatch(thunk)
        middlewareWarning(getState)

        const { requestId, abort } = thunkResult

        console.log('runningQueries', runningQueries)
        const prevThunks = Object.values(runningQueries?.[queryCacheKey] || {})
        const allIds = [
          thunkResult.requestId,
          ...prevThunks.map((x) => x?.requestId),
        ]

        console.log('thunkResult', thunkResult.requestId, 'allIds', allIds)
        console.log('prev thunks', prevThunks)

        const thunkResult2 = thunkResult.then((x) => {
          console.log('finished thunk', thunkResult.requestId, 'val', x)
          return x
        })

        let promises: Promise<any>[] = [...prevThunks, thunkResult2]
        console.log('promises', promises)
        const statePromise: QueryActionCreatorResult<any> = Object.assign(
          Promise.all(promises).then((x) => {
            console.log(
              'finished promises for',
              requestId,
              promises,
              'allIds',
              allIds,
              'result',
              x
            )
            const res = (
              api.endpoints[endpointName] as ApiEndpointQuery<any, any>
            ).select(arg)(getState())
            console.log('data for', requestId, res)
            console.log('getState', getState())
            return res
          }),
          {
            waitingOn: allIds,
            arg,
            requestId,
            subscriptionOptions,
            queryCacheKey,
            abort,
            async unwrap() {
              const result = await statePromise

              if (result.isError) {
                throw result.error
              }

              return result.data
            },
            refetch() {
              dispatch(
                queryAction(arg, { subscribe: false, forceRefetch: true })
              )
            },
            unsubscribe() {
              if (subscribe)
                dispatch(
                  unsubscribeQueryResult({
                    queryCacheKey,
                    requestId,
                  })
                )
            },
            updateSubscriptionOptions(options: SubscriptionOptions) {
              statePromise.subscriptionOptions = options
              dispatch(
                updateSubscriptionOptions({
                  endpointName,
                  requestId,
                  queryCacheKey,
                  options,
                })
              )
            },
          }
        )

        if (!runningQueries.hasOwnProperty(queryCacheKey)) {
          runningQueries[queryCacheKey] = {}
        }

        runningQueries[queryCacheKey][requestId] = statePromise
        statePromise.then(() => {
          delete runningQueries?.[queryCacheKey]?.[requestId]
        })

        return statePromise
      }
    return queryAction
  }

  function buildInitiateMutation(
    endpointName: string
  ): StartMutationActionCreator<any> {
    return (arg, { track = true, fixedCacheKey } = {}) =>
      (dispatch, getState) => {
        const thunk = mutationThunk({
          type: 'mutation',
          endpointName,
          originalArgs: arg,
          track,
          fixedCacheKey,
        })
        const thunkResult = dispatch(thunk)
        middlewareWarning(getState)
        const { requestId, abort, unwrap } = thunkResult
        const returnValuePromise = thunkResult
          .unwrap()
          .then((data) => ({ data }))
          .catch((error) => ({ error }))

        const reset = () => {
          dispatch(removeMutationResult({ requestId, fixedCacheKey }))
        }

        const ret = Object.assign(returnValuePromise, {
          arg: thunkResult.arg,
          requestId,
          abort,
          unwrap,
          unsubscribe: reset,
          reset,
        })

        runningMutations[requestId] = ret
        ret.then(() => {
          delete runningMutations[requestId]
        })
        if (fixedCacheKey) {
          runningMutations[fixedCacheKey] = ret
          ret.then(() => {
            if (runningMutations[fixedCacheKey] === ret)
              delete runningMutations[fixedCacheKey]
          })
        }

        return ret
      }
  }
}
