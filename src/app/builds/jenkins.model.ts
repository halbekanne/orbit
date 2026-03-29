export interface JenkinsBranch {
  name: string;
  color: string;
  url: string;
}

export interface JenkinsBuild {
  number: number;
  result: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | null;
  timestamp: number;
  duration: number;
  url: string;
}

export interface JenkinsBuildDetail {
  number: number;
  result: 'SUCCESS' | 'FAILURE' | 'UNSTABLE' | 'ABORTED' | 'NOT_BUILT' | null;
  duration: number;
  timestamp: number;
  building: boolean;
  estimatedDuration: number;
  description: string | null;
  url: string;
  actions: JenkinsBuildAction[];
}

export interface JenkinsBuildAction {
  _class: string;
  parameters?: JenkinsBuildParameter[];
}

export interface JenkinsBuildParameter {
  name: string;
  value: string | boolean | number;
}

export type JenkinsStageStatus = 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'PAUSED_PENDING_INPUT' | 'NOT_EXECUTED';

export interface JenkinsStage {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  startTimeMillis: number;
  durationMillis: number;
  execNode: string;
}

export interface JenkinsRun {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  startTimeMillis: number;
  endTimeMillis: number;
  durationMillis: number;
  stages: JenkinsStage[];
}

export interface JenkinsStageDetail {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  stageFlowNodes: JenkinsStageFlowNode[];
}

export interface JenkinsStageFlowNode {
  id: string;
  name: string;
  status: JenkinsStageStatus;
  parameterDescription: string;
  startTimeMillis: number;
  durationMillis: number;
  parentNodes: string[];
  error?: JenkinsStageError;
}

export interface JenkinsStageError {
  message: string;
  type: string;
}

export interface JenkinsStageLog {
  nodeId: string;
  nodeStatus: string;
  length: number;
  hasMore: boolean;
  text: string;
  consoleUrl: string;
}

export type JenkinsParameterDefinition =
  | JenkinsStringParameter
  | JenkinsBooleanParameter
  | JenkinsChoiceParameter
  | JenkinsTextParameter
  | JenkinsPasswordParameter;

interface JenkinsParameterBase {
  name: string;
  description: string;
}

export interface JenkinsStringParameter extends JenkinsParameterBase {
  type: 'StringParameterDefinition';
  defaultParameterValue: { value: string };
}

export interface JenkinsBooleanParameter extends JenkinsParameterBase {
  type: 'BooleanParameterDefinition';
  defaultParameterValue: { value: boolean };
}

export interface JenkinsChoiceParameter extends JenkinsParameterBase {
  type: 'ChoiceParameterDefinition';
  defaultParameterValue: { value: string };
  choices: string[];
}

export interface JenkinsTextParameter extends JenkinsParameterBase {
  type: 'TextParameterDefinition';
  defaultParameterValue: { value: string };
}

export interface JenkinsPasswordParameter extends JenkinsParameterBase {
  type: 'PasswordParameterDefinition';
  defaultParameterValue: { value: string };
}

export interface BranchBuild {
  jobDisplayName: string;
  jobPath: string;
  branchName: string;
  branchColor: string;
  lastBuild: JenkinsBuild | null;
  prNumber: number | null;
}
