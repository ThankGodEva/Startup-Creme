import React from 'react';
import { BarChart2, Check, CheckCircle2, Vote } from 'lucide-react';
import { DiscussionPoll, UserProfile } from '../types';

interface PollWidgetProps {
  poll: DiscussionPoll;
  userPollVote: string | undefined;
  onVotePoll: (pollId: string, optionId: string) => void;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
}

export const PollWidget: React.FC<PollWidgetProps> = ({
  poll,
  userPollVote,
  onVotePoll,
  currentUser,
  onOpenAuth,
}) => {
  const totalVotes = poll.total_votes || poll.options.reduce((acc, opt) => acc + (opt.votes || 0), 0);
  const selectedOption = poll.options.find(o => o.id === userPollVote);

  return (
    <div className="bg-slate-50 border border-teal-200/80 rounded-2xl p-4 sm:p-5 shadow-xs my-5">
      {/* Poll Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100 text-teal-900 border border-teal-300/80 text-[11px] font-mono font-bold tracking-wide uppercase">
          <BarChart2 className="w-3.5 h-3.5 text-teal-700" />
          <span>Interactive Poll</span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 font-medium">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      {/* Question */}
      <h4 className="font-serif text-base sm:text-lg font-bold text-slate-900 mb-1 leading-snug">
        {poll.question}
      </h4>
      <p className="text-[11px] font-sans text-slate-500 mb-4">
        {selectedOption ? 'Tap another option to change your choice' : 'Select an option to cast your vote'}
      </p>

      {/* Poll Options (WhatsApp style) */}
      <div className="space-y-2.5">
        {poll.options.map((opt) => {
          const isSelected = userPollVote === opt.id;
          const votesCount = opt.votes || 0;
          const percentage = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;

          return (
            <button
              key={opt.id}
              onClick={() => {
                if (!currentUser) {
                  onOpenAuth();
                } else {
                  onVotePoll(poll.id, opt.id);
                }
              }}
              type="button"
              className={`w-full text-left relative overflow-hidden rounded-xl border transition-all duration-200 p-3 sm:p-3.5 ${
                isSelected
                  ? 'border-teal-500 bg-teal-50/70 ring-2 ring-teal-500/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              }`}
            >
              {/* WhatsApp Animated Progress Bar Fill */}
              <div
                className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ease-out rounded-l-xl ${
                  isSelected ? 'bg-teal-500/20 border-r-2 border-teal-500' : 'bg-slate-200/50'
                }`}
                style={{ width: `${percentage}%` }}
              />

              {/* Option Row Content */}
              <div className="relative z-10 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Radio Indicator */}
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white shrink-0 group-hover:border-teal-400" />
                  )}

                  {/* Option Text */}
                  <span className={`font-medium truncate ${isSelected ? 'text-teal-950 font-bold' : 'text-slate-800'}`}>
                    {opt.option_text}
                  </span>
                </div>

                {/* Percentage & Vote Count */}
                <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                  <span className={`font-bold ${isSelected ? 'text-teal-800' : 'text-slate-700'}`}>
                    {percentage}%
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    ({votesCount} {votesCount === 1 ? 'vote' : 'votes'})
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      {selectedOption && (
        <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-sans text-teal-800">
          <span className="flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span>You voted: <strong>{selectedOption.option_text}</strong></span>
          </span>
          <span className="font-mono text-slate-400">Recorded</span>
        </div>
      )}
    </div>
  );
};
