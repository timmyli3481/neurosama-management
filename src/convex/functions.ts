import { entsTableFactory } from "convex-ents";
import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  mutation as baseMutation,
  query as baseQuery,
} from "./_generated/server";
import { entDefinitions } from "./schema";
 
import { scheduledDeleteFactory } from "convex-ents";

export const scheduledDelete = scheduledDeleteFactory(entDefinitions); 

export const query = customQuery(
  baseQuery,
  customCtx(async (ctx,db) => {
    return {
      table: entsTableFactory(ctx, entDefinitions),
      db: undefined,
      unsafeDB_DO_NOT_USE_OR_YOULL_BE_FIRED: db,
    };
  }),
);
 
export const internalQuery = customQuery(
  baseInternalQuery,
  customCtx(async (ctx,db) => {
    return {
      table: entsTableFactory(ctx, entDefinitions),
      db: undefined,
      unsafeDB_DO_NOT_USE_OR_YOULL_BE_FIRED: db,
    };
  }),
);
 
export const mutation = customMutation(
  baseMutation,
  customCtx(async (ctx,db) => {
    return {
      table: entsTableFactory(ctx, entDefinitions),
      db: undefined,
      unsafeDB_DO_NOT_USE_OR_YOULL_BE_FIRED: db,
    };
  }),
);
 
export const internalMutation = customMutation(
  baseInternalMutation,
  customCtx(async (ctx,db) => {
    return {
      table: entsTableFactory(ctx, entDefinitions),
      db: undefined,
      unsafeDB_DO_NOT_USE_OR_YOULL_BE_FIRED: db,
    };
  }),
);

