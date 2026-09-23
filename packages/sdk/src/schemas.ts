import {
  clientDtoSchema,
  listResultSchema,
  personalAccessTokenCreatedSchema,
  personalAccessTokenListSchema,
  projectDtoSchema,
  rateDtoSchema,
  effectiveRatesDtoSchema,
  tagDtoSchema,
  taskDtoSchema,
  timeEntryDtoSchema,
  timeEntryListResultSchema,
  copyPreviousWeekResultSchema,
  weeklyTimeSummarySchema,
  timesheetDtoSchema,
  timesheetListResultSchema,
} from '@stampp/shared';

export const clientListSchema = listResultSchema(clientDtoSchema);
export const projectListSchema = listResultSchema(projectDtoSchema);
export const taskListSchema = listResultSchema(taskDtoSchema);
export const tagListSchema = listResultSchema(tagDtoSchema);
export const rateListSchema = listResultSchema(rateDtoSchema);

export {
  copyPreviousWeekResultSchema,
  effectiveRatesDtoSchema,
  personalAccessTokenCreatedSchema,
  personalAccessTokenListSchema,
  projectDtoSchema,
  clientDtoSchema,
  rateDtoSchema,
  tagDtoSchema,
  taskDtoSchema,
  timeEntryDtoSchema,
  timeEntryListResultSchema,
  timesheetDtoSchema,
  timesheetListResultSchema,
  weeklyTimeSummarySchema,
};
