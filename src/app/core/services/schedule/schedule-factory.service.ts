import { Injectable } from '@angular/core';

import { DefaultScheduleServiceType } from '../../../../assets/data/defaultConfig';
import { ConfigKeys } from '../../../shared/enums/config';
import { Assessment, AssessmentType } from '../../../shared/models/assessment';
import { SchedulerType } from '../../../shared/models/notification-handler';
import { LogService } from '../misc/log.service';
import { StorageService } from '../storage/storage.service';
import { LocalScheduleService } from './local-schedule.service';
import { ScheduleService } from './schedule.service';

@Injectable()
export class ScheduleFactoryService extends ScheduleService {
  scheduleService: ScheduleService;

  constructor(
    public localScheduleService: LocalScheduleService,
    private store: StorageService,
    logger: LogService
  ) {
    super(store, logger);
  }

  init() {
    return Promise.resolve(DefaultScheduleServiceType).then((type) => {
      switch (type) {
        case SchedulerType.LOCAL:
          return (this.scheduleService = this.localScheduleService);
        case SchedulerType.APPSERVER:
          return (this.scheduleService = this.localScheduleService);
        default:
          throw new Error('No such scheduling service available');
      }
    });
  }

  isInitialised() {
    return this.scheduleService != null || this.scheduleService != undefined;
  }

  generateSchedule(referenceTimestamp, utcOffsetPrev) {
    return this.scheduleService.generateSchedule(
      referenceTimestamp,
      utcOffsetPrev
    );
  }

  generateSingleAssessmentTask(
    assessment: Assessment,
    assessmentType,
    referenceDate: number
  ) {
    return this.scheduleService.generateSingleAssessmentTask(
      assessment,
      assessmentType,
      referenceDate
    );
  }

  getTasksForDate(date: Date, type: AssessmentType) {
    return this.scheduleService.getTasksForDate(date, type);
  }

  updateTaskToComplete(updatedTask): Promise<any> {
    return this.scheduleService.updateTaskToComplete(updatedTask);
  }
}
