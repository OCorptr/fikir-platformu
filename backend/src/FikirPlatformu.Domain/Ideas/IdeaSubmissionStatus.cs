namespace FikirPlatformu.Domain.Ideas;

public enum IdeaSubmissionStatus
{
    Draft = 0,
    Submitted = 1,
    InEvaluation = 2,
    EvaluationCompleted = 3,
    Locked = 4,
    Planned = 5,
    ImplementationInProgress = 6,
    ImplementationCompleted = 7,
    ImplementationFailed = 8,
    Deleted = 9,
}
