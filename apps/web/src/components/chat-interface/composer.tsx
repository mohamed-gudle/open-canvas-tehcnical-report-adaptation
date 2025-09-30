"use client";

import { ComposerPrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { type FC, useState, useEffect } from "react";

import { TooltipIconButton } from "@/components/ui/assistant-ui/tooltip-icon-button";
import { SendHorizontalIcon } from "lucide-react";
import { DragAndDropWrapper } from "./drag-drop-wrapper";
import { ComposerAttachments } from "../assistant-ui/attachment";
import { ComposerActionsPopOut } from "./composer-actions-popout";

const GENERIC_PLACEHOLDERS = [
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

const SEARCH_PLACEHOLDERS = [
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

const getRandomPlaceholder = (searchEnabled: boolean) => {
  return searchEnabled
    ? SEARCH_PLACEHOLDERS[
        Math.floor(Math.random() * SEARCH_PLACEHOLDERS.length)
      ]
    : GENERIC_PLACEHOLDERS[
        Math.floor(Math.random() * GENERIC_PLACEHOLDERS.length)
      ];
};

const CircleStopIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      width="16"
      height="16"
    >
      <rect width="10" height="10" x="3" y="3" rx="2" />
    </svg>
  );
};

interface ComposerProps {
  chatStarted: boolean;
  userId: string | undefined;
  searchEnabled: boolean;
}

export const Composer: FC<ComposerProps> = (props: ComposerProps) => {
  const [placeholder, setPlaceholder] = useState("");

  useEffect(() => {
    setPlaceholder(getRandomPlaceholder(props.searchEnabled));
  }, [props.searchEnabled]);

  return (
    <DragAndDropWrapper>
      <ComposerPrimitive.Root className="focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 flex flex-col w-full min-h-[64px] flex-wrap items-center justify-center border border-primary/20 bg-card/90 backdrop-blur px-2.5 shadow-sm transition-all ease-in rounded-2xl">
        <div className="flex flex-wrap gap-2 items-start mr-auto">
          <ComposerAttachments />
        </div>

        <div className="flex flex-row w-full items-center justify-start my-auto">
          <ComposerActionsPopOut
            userId={props.userId}
            chatStarted={props.chatStarted}
          />
          <ComposerPrimitive.Input
            autoFocus
            placeholder={placeholder}
            rows={1}
            className="placeholder:text-primary/50 text-primary max-h-40 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed"
          />
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send asChild>
              <TooltipIconButton
                tooltip="Send"
                variant="default"
                className="my-2.5 size-8 p-2 transition-opacity ease-in"
              >
                <SendHorizontalIcon />
              </TooltipIconButton>
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel asChild>
              <TooltipIconButton
                tooltip="Cancel"
                variant="default"
                className="my-2.5 size-8 p-2 transition-opacity ease-in"
              >
                <CircleStopIcon />
              </TooltipIconButton>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </div>
      </ComposerPrimitive.Root>
    </DragAndDropWrapper>
  );
};
