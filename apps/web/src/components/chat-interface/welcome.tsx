import { ThreadPrimitive, useThreadRuntime } from "@assistant-ui/react";
import { FC, useMemo } from "react";
import { TighterText } from "../ui/header";
import { NotebookPen } from "lucide-react";
import { Button } from "../ui/button";

const QUICK_START_PROMPTS_SEARCH = [
    "Draft a pre-feasibility outline for a 20MW solar project in West Africa, including land and grid considerations.",
    "Generate a risk register with top 5 risks for renewable projects in Africa (e.g., financing, land rights, grid reliability).",
    "Create a checklist for the DPR sections for a 50MW solar PV project in Kenya.",
    "Generate a sample PFD for a small hydro project in East Africa.",
    "Draft a technology selection justification memo considering local vendor availability in Africa.",
    "Summarize ESIA compliance actions into an EMP tailored for African environmental regulations.",
    "Generate a template for EPC RFP adapted to African renewable energy projects.",
    "Draft QA/QC test plan for foundation works in tropical soil conditions.",
    "Create a weekly progress report template for African stakeholders (developers, regulators, financiers).",
    "Summarize HSE plan into key safety actions for high-temperature and remote-site conditions.",
    "Draft a commissioning test checklist for a solar PV mini-grid in rural Africa.",
    "Create a quick-start O&M manual outline for local technicians in Sub-Saharan Africa.",
    "Generate a monthly O&M log template for a solar PV farm in East Africa.",
    "Draft a financial summary of revenue vs. PPA in the context of African tariff structures.",
    "List top 5 recurring maintenance issues for solar plants in hot, dusty environments.",
    "Draft decommissioning plan outline for a 20-year-old solar farm in Africa.",
    "Generate site restoration action list considering land use for agriculture in rural Africa.",
    "Create final project closure report highlights tailored to African stakeholders and financiers."
];

const QUICK_START_PROMPTS = [
    "Summarize the key objectives from the concept note for a rural electrification project in East Africa.",
    "Compare wind vs. solar potential for a site in the Sahel region using regional climate data.",
    "Extract site survey highlights into a 1-page brief focusing on topography and hydrology in Sub-Saharan Africa.",
    "Summarize ESIA scoping findings into bullet points with emphasis on community engagement and biodiversity.",
    "Review the grid interconnection study and list risks for weak grids in Sub-Saharan Africa.",
    "List required permits for a 50MW wind project in South Africa.",
    "Summarize BoQ into major cost categories with emphasis on import duties and logistics in Africa.",
    "List top vendor selection criteria for turbines suitable for African wind projects.",
    "Convert construction drawings into a method statement outline for a project in a remote African region.",
    "Summarize performance test results for a 10MW wind project in North Africa.",
    "Generate as-built drawing summary table for African regulators.",
    "Summarize grid compliance report findings for African utility standards.",
    "Summarize downtime logs and root causes considering African grid instability.",
    "Summarize safety incidents into a quarterly report for African project regulators.",
    "Summarize dismantling environmental impacts with focus on recycling PV panels and turbine blades."
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
