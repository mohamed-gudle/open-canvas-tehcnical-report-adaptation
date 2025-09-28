import { ThreadPrimitive, useThreadRuntime } from "@assistant-ui/react";
import { FC, useMemo } from "react";
import { TighterText } from "../ui/header";
import { NotebookPen } from "lucide-react";
import { Button } from "../ui/button";

const QUICK_START_PROMPTS_SEARCH = [
  "Map the highest readiness clean-energy corridors across the ECOWAS region using latest policy data",
  "Draft a permitting brief for a 100MW solar-plus-storage plant in northern Kenya",
  "Summarize capital flows into African green hydrogen hubs over the past two quarters",
  "Outline a blended finance structure to de-risk mini-grid rollouts in Sierra Leone",
  "Build a dashboard concept that tracks NDC-aligned power projects in Southern Africa",
  "Prepare investor talking points on resilient grid upgrades for West African capitals",
  "Identify climate adaptation projects eligible for loss-and-damage funding in the Horn of Africa",
  "Create a due diligence checklist for utility-scale wind investments in Namibia",
  "Draft a briefing note on cross-border transmission partnerships within the Nile Basin",
  "Plan a stakeholder workshop agenda for accelerating clean cooking access in urban Nigeria",
];

const QUICK_START_PROMPTS = [
  "Write a vision statement for the Africa Climate and Energy Nexus workspace",
  "Draft a partnership outreach email to development finance institutions",
  "Sketch a project charter for scaling rooftop solar across francophone West Africa",
  "Summarize the co-benefits of regenerative agriculture pilots in Rwanda",
  "Create a sprint plan for digitizing permitting workflows in Tanzania",
  "Draft a celebratory announcement for a newly funded AFCEN flagship project",
  "Translate an impact brief on resilient microgrids into investor-friendly copy",
  "Outline an AFCEN governance update for regional energy ministers",
  "Break down a community solar revenue model for peri-urban Ghana",
  "Prepare a progress update for AFCEN's climate data commons initiative",
  "Write a feature story spotlighting women-led climate ventures on the platform",
  "Draft a project update on grid integration lessons from South African renewables",
  "Compose guidance for governments on accelerating green industrial corridors",
  "Build a checklist for onboarding new AFCEN project developers",
];

function getRandomPrompts(prompts: string[], count: number = 4): string[] {
  return [...prompts].sort(() => Math.random() - 0.5).slice(0, count);
}

interface QuickStartButtonsProps {
  handleQuickStart: () => void;
  composer: React.ReactNode;
  searchEnabled: boolean;
}

interface QuickStartPromptsProps {
  searchEnabled: boolean;
}

const QuickStartPrompts = ({ searchEnabled }: QuickStartPromptsProps) => {
  const threadRuntime = useThreadRuntime();

  const handleClick = (text: string) => {
    threadRuntime.append({
      role: "user",
      content: [{ type: "text", text }],
    });
  };

  const selectedPrompts = useMemo(
    () =>
      getRandomPrompts(
        searchEnabled ? QUICK_START_PROMPTS_SEARCH : QUICK_START_PROMPTS
      ),
    [searchEnabled]
  );

  return (
    <div className="flex flex-col w-full gap-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
        {selectedPrompts.map((prompt, index) => (
          <Button
            key={`quick-start-prompt-${index}`}
            onClick={() => handleClick(prompt)}
            variant="outline"
            className="min-h-[60px] w-full flex items-center justify-center p-6 whitespace-normal border-primary/30 text-primary/80 hover:text-primary bg-white/60 hover:bg-primary/10 transition-colors ease-in rounded-2xl"
          >
            <p className="text-center break-words text-sm font-normal">
              {prompt}
            </p>
          </Button>
        ))}
      </div>
    </div>
  );
};

const QuickStartButtons = (props: QuickStartButtonsProps) => {
  return (
    <div className="flex flex-col gap-8 items-center justify-center w-full">
      <div className="flex flex-col gap-6">
        <p className="text-primary/70 text-sm uppercase tracking-[0.2em]">
          Launch an AFCEN workspace
        </p>
        <div className="flex flex-row gap-1 items-center justify-center w-full">
          <Button
            variant="outline"
            className="text-primary font-medium border-primary/40 hover:border-primary/60 hover:bg-primary/10 transition-colors ease-in rounded-2xl flex items-center justify-center gap-2 w-[250px] h-[64px]"
            onClick={() => props.handleQuickStart()}
          >
            New AFCEN Brief
            <NotebookPen />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-6 mt-2 w-full">
        <p className="text-primary/70 text-sm uppercase tracking-[0.2em]">
          Or start with a prompt
        </p>
        {props.composer}
        <QuickStartPrompts searchEnabled={props.searchEnabled} />
      </div>
    </div>
  );
};

interface ThreadWelcomeProps {
  handleQuickStart: () => void;
  composer: React.ReactNode;
  searchEnabled: boolean;
}

export const ThreadWelcome: FC<ThreadWelcomeProps> = (
  props: ThreadWelcomeProps
) => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex items-center justify-center mt-16 w-full px-4">
        <div className="text-center max-w-3xl w-full space-y-6">
          <img
            src="/logo.svg"
            alt="Africa Climate and Energy Nexus"
            className="mx-auto h-20 w-auto"
            style={{ maxHeight: '80px' }}
          />
          <TighterText className="text-sm uppercase text-primary/70 tracking-[0.25em]">
            Africa Climate & Energy Nexus
          </TighterText>
          <h1 className="text-3xl md:text-4xl font-semibold text-primary">
            Africa is shaping solutions for the world — how can we accelerate
            your climate and energy project today?
          </h1>
          <p className="mx-auto max-w-2xl text-base text-primary/80">
            AFCEN brings projects, policy, and capital into a single workspace
            so governments, developers, and investors can track readiness,
            de-risk pipelines, and deliver faster.
          </p>
          <div className="mt-10 w-full">
            <QuickStartButtons
              composer={props.composer}
              handleQuickStart={props.handleQuickStart}
              searchEnabled={props.searchEnabled}
            />
          </div>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};
