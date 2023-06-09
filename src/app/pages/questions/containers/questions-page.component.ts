import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { IonSlides, NavController, Platform } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { AlertService } from '../../../core/services/misc/alert.service';
import { LocalizationService } from '../../../core/services/misc/localization.service';
import {
  NextButtonEventType,
  UsageEventType,
} from '../../../shared/enums/events';
import { LocKeys } from '../../../shared/enums/localisations';
import {
  Assessment,
  AssessmentType,
  ShowIntroductionType,
} from '../../../shared/models/assessment';
import {
  ExternalApp,
  Question,
  QuestionType,
} from '../../../shared/models/question';
import { Task } from '../../../shared/models/task';
import { AppLauncherService } from '../services/app-launcher.service';
import { QuestionsService } from '../services/questions.service';
import { questions } from './questions';

@Component({
  selector: 'page-questions',
  templateUrl: 'questions-page.component.html',
  styleUrls: ['questions-page.component.scss'],
})
export class QuestionsPageComponent implements OnInit {
  @ViewChild(IonSlides, { static: true }) slides: IonSlides;

  startTime: number;
  currentQuestionGroupId = 0;
  nextQuestionGroupId: number;
  questionOrder = [0];
  allQuestionIndices = [];
  isLeftButtonDisabled = false;
  isRightButtonDisabled = true;
  task: Task;
  taskType: AssessmentType;
  questions: Question[];
  externalApp: ExternalApp;
  // Questions grouped by matrix group if it exists
  groupedQuestions: Map<string, Question[]>;
  // Indices of questions (of the group) currently shown
  currentQuestionIndices: number[];
  questionTitle: string;
  endText: string;
  isLastTask: boolean;
  requiresInClinicCompletion: boolean;
  introduction: string;
  assessment: Assessment;
  showIntroductionScreen: boolean;
  showDoneButton: boolean;
  showFinishScreen: boolean;
  showFinishAndLaunchScreen: boolean = false;
  externalAppCanLaunch: boolean = false;
  viewEntered = false;

  SHOW_INTRODUCTION_SET: Set<boolean | ShowIntroductionType> = new Set([
    true,
    ShowIntroductionType.ALWAYS,
    ShowIntroductionType.ONCE,
  ]);
  MATRIX_FIELD_NAME = 'matrix';
  HEALTH_FIELD_NAME = 'health';
  backButtonListener: Subscription;
  showProgressCount: Promise<boolean>;

  constructor(
    public navCtrl: NavController,
    private questionsService: QuestionsService,
    private platform: Platform,
    private localization: LocalizationService,
    private router: Router,
    private alertService: AlertService
  ) {
    console.log('hello');
    this.backButtonListener = this.platform.backButton.subscribe(() => {
      this.sendCompletionLog();
      navigator['app'].exitApp();
      // this.platform.exitApp()
    });
  }

  ionViewDidLeave() {
    this.sendCompletionLog();
    this.questionsService.reset();
    this.backButtonListener.unsubscribe();
  }

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    if (nav) {
      this.task = nav.extras.state as Task;
      this.showProgressCount = this.questionsService.getIsProgressCountShown();
      this.initQuestionnaire();
      this.updateToolbarButtons();
      this.questionsService.initRemoteConfigParams();
      this.sendEvent(UsageEventType.QUESTIONNAIRE_STARTED);
      this.slides.lockSwipes(true);
    }
  }

  ionViewWillEnter() {
    this.slides.update();
  }

  initQuestionnaire() {
    this.startTime = this.questionsService.getTime();
    this.questionTitle = 'PHQ8';
    this.introduction = 'Introduction';
    this.showIntroductionScreen = false;
    this.questions = questions;
    this.groupedQuestions = this.groupQuestionsByMatrixGroup(this.questions);
    this.endText = this.localization.translateKey(LocKeys.FINISH_THANKS);
    this.isLastTask = false;
    // this.taskType = 'default';
    this.requiresInClinicCompletion = false;
    const groupKeys = Array.from(this.groupedQuestions.keys());
    this.currentQuestionIndices = Object.keys(
      this.groupedQuestions.get(groupKeys[0])
    ).map(Number);
    this.allQuestionIndices[0] = this.currentQuestionIndices;
  }

  groupQuestionsByMatrixGroup(questions: Question[]) {
    const groupedQuestions = new Map<string, Question[]>();
    questions.forEach((q) => {
      const key =
        q.field_type.includes(this.MATRIX_FIELD_NAME) ||
        q.field_type.includes(this.HEALTH_FIELD_NAME)
          ? q.matrix_group_name
          : q.field_name;
      const entry = groupedQuestions.get(key) ? groupedQuestions.get(key) : [];
      entry.push(q);
      //?
      groupedQuestions.set(key, entry);
    });

    return groupedQuestions;
  }

  handleIntro(start: boolean) {
    this.showIntroductionScreen = false;
    this.questionsService.updateAssessmentIntroduction(
      this.assessment,
      this.taskType
    );
    if (start) {
      this.slides.update();
      this.slideQuestion();
    } else this.exitQuestionnaire();
  }

  handleFinish(completedInClinic?: boolean) {
    console.log('hi');
    return this.router.navigate(['/']);
  }

  onAnswer(event) {
    if (event.id) this.questionsService.submitAnswer(event);
  }

  slideQuestion() {
    console.log(this.currentQuestionGroupId);
    this.slides
      .lockSwipes(false)
      .then(() => this.slides.slideTo(this.currentQuestionGroupId, 300))
      .then(() => this.slides.lockSwipes(true));

    this.startTime = this.questionsService.getTime();
  }

  getCurrentQuestions() {
    // For non-matrix type this will only return one question (array) but for matrix types, this can be more than one
    const key = Array.from(this.groupedQuestions.keys())[
      this.currentQuestionGroupId
    ];
    return this.groupedQuestions.get(key);
  }

  submitTimestamps() {
    const currentQuestions = this.getCurrentQuestions();
    currentQuestions.forEach((q) =>
      this.questionsService.recordTimeStamp(q, this.startTime)
    );
  }

  nextAction(event) {
    if (event == NextButtonEventType.AUTO)
      return setTimeout(() => this.nextQuestion(), 100);
    if (event == NextButtonEventType.ENABLE)
      return setTimeout(() => this.updateToolbarButtons(), 100);
    if (event == NextButtonEventType.DISABLE)
      return (this.isRightButtonDisabled = true);
  }

  nextQuestion() {
    const questionPosition = this.questionsService.getNextQuestion(
      this.groupedQuestions,
      this.currentQuestionGroupId
    );
    this.nextQuestionGroupId = questionPosition.groupKeyIndex;
    this.currentQuestionIndices = questionPosition.questionIndices;
    if (this.isLastQuestion()) return this.navigateToFinishPage();
    this.questionOrder.push(this.nextQuestionGroupId);
    this.allQuestionIndices[this.nextQuestionGroupId] =
      this.currentQuestionIndices;
    this.submitTimestamps();
    this.currentQuestionGroupId = this.nextQuestionGroupId;
    this.slideQuestion();
    this.updateToolbarButtons();
  }

  previousQuestion() {
    const currentQuestions = this.getCurrentQuestions();
    this.questionOrder.pop();
    this.currentQuestionGroupId =
      this.questionOrder[this.questionOrder.length - 1];
    this.currentQuestionIndices =
      this.allQuestionIndices[this.currentQuestionGroupId];
    this.updateToolbarButtons();
    if (!this.isRightButtonDisabled)
      this.questionsService.deleteLastAnswers(currentQuestions);
    this.slideQuestion();
  }

  updateToolbarButtons() {
    // NOTE: Only the first question of each question group is used
    const currentQs = this.getCurrentQuestions();
    if (!currentQs) return;
    this.isRightButtonDisabled =
      !this.questionsService.isAnyAnswered(currentQs) &&
      !this.questionsService.getIsAnyNextEnabled(currentQs);
    this.isLeftButtonDisabled =
      this.questionsService.getIsAnyPreviousEnabled(currentQs);
  }

  exitQuestionnaire() {
    this.sendEvent(UsageEventType.QUESTIONNAIRE_CANCELLED);
    this.navCtrl.navigateBack('/');
    // this.navCtrl.pop({ animation: 'wp-transition' })
  }

  navigateToFinishPage() {
    this.sendEvent(UsageEventType.QUESTIONNAIRE_FINISHED);
    this.submitTimestamps();
    this.showFinishScreen = true;
    this.slides
      .lockSwipes(false)
      .then(() => this.slides.slideTo(this.groupedQuestions.size, 500))
      .then(() => this.slides.lockSwipes(true));
  }

  updateDoneButton(val: boolean) {
    this.showDoneButton = val;
  }

  sendEvent(type) {}

  sendCompletionLog() {}

  isLastQuestion() {
    return this.nextQuestionGroupId >= this.groupedQuestions.size;
  }

  asIsOrder(a, b) {
    // NOTE: This is needed to display questions (in the view) from the map in order
    return 1;
  }

  showDisabledButtonAlert() {
    const currentQuestionType = this.getCurrentQuestions()[0].field_type;
    // NOTE: Show alert when next is tapped without finishing audio question
    if (currentQuestionType == QuestionType.audio)
      this.alertService.showAlert({
        message: this.localization.translateKey(
          LocKeys.AUDIO_TASK_BUTTON_ALERT_DESC
        ),
        buttons: [
          {
            text: this.localization.translateKey(LocKeys.BTN_DISMISS),
            handler: () => {},
          },
        ],
      });
  }
}
