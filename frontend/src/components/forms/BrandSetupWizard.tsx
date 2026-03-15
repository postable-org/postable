"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { createBrand } from "@/lib/api/brands";
import { updateCompetitors } from "@/lib/api/competitors";
import StepCompanyInfo from "./steps/StepCompanyInfo";
import StepNicheLocation from "./steps/StepNicheLocation";
import StepScale from "./steps/StepScale";
import StepLocation from "./steps/StepLocation";
import StepToneOfVoice from "./steps/StepToneOfVoice";
import StepCTAChannel from "./steps/StepCTAChannel";
import StepCompetitors from "./steps/StepCompetitors";
import StepReview from "./steps/StepReview";

export interface WizardFormData {
  company_name: string;
  niche: string;
  niche_custom: string;
  scale: string;
  country: string;
  city: string;
  state: string;
  tone_of_voice: string;
  tone_custom: string;
  cta_channel: "" | "whatsapp" | "landing_page" | "dm";
  competitors: string[];
}

const STEP_TITLES = [
  "Sua empresa",
  "Nicho",
  "Tamanho",
  "Localização",
  "Tom de voz",
  "Canal de CTA",
  "Concorrentes",
  "Revisão",
];

const TOTAL_STEPS = STEP_TITLES.length;

function canContinue(step: number, data: WizardFormData): boolean {
  switch (step) {
    case 0:
      return data.company_name.trim().length > 0;
    case 1:
      return (
        data.niche !== "" &&
        (data.niche !== "outro" || data.niche_custom.trim().length > 0)
      );
    case 2:
      return data.scale !== "";
    case 3:
      return (
        data.city.trim().length > 0 &&
        (data.country !== "BR" || data.state !== "")
      );
    case 4:
      return (
        data.tone_of_voice !== "" &&
        (data.tone_of_voice !== "other" || data.tone_custom.trim().length > 0)
      );
    case 5:
      return data.cta_channel !== "";
    case 6:
      return true; // optional
    case 7:
      return true; // review
    default:
      return false;
  }
}

export default function BrandSetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [formData, setFormData] = useState<WizardFormData>({
    company_name: "",
    niche: "",
    niche_custom: "",
    scale: "",
    country: "BR",
    city: "",
    state: "",
    tone_of_voice: "",
    tone_custom: "",
    cta_channel: "",
    competitors: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  const ready = canContinue(step, formData);

  const goNext = async () => {
    if (step === TOTAL_STEPS - 1) {
      await handleSubmit();
    } else {
      setDirection("forward");
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    setDirection("back");
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmitError("");
    try {
      const niche =
        formData.niche === "outro" ? formData.niche_custom : formData.niche;
      await createBrand({
        name: formData.company_name,
        niche,
        city: formData.city,
        state: formData.state || formData.country,
        tone_of_voice: formData.tone_of_voice,
        tone_custom: formData.tone_custom || null,
        cta_channel: formData.cta_channel as "whatsapp" | "landing_page" | "dm",
      });
      if (formData.competitors.length > 0) {
        await updateCompetitors(
          formData.competitors.map((h) => ({ type: "add" as const, handle: h }))
        );
      }
      router.push("/dashboard");
    } catch {
      setSubmitError("Erro ao criar marca. Tente novamente.");
      setIsLoading(false);
    }
  };

  const update = (patch: Partial<WizardFormData>) =>
    setFormData((prev) => ({ ...prev, ...patch }));

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepCompanyInfo
            value={formData.company_name}
            onChange={(v) => update({ company_name: v })}
          />
        );
      case 1:
        return (
          <StepNicheLocation
            niche={formData.niche}
            nicheCustom={formData.niche_custom}
            onChange={(niche, niche_custom) =>
              update({ niche, niche_custom: niche_custom ?? "" })
            }
          />
        );
      case 2:
        return (
          <StepScale
            value={formData.scale}
            onChange={(v) => update({ scale: v })}
          />
        );
      case 3:
        return (
          <StepLocation
            country={formData.country}
            state={formData.state}
            city={formData.city}
            onChange={(patch) => update(patch)}
          />
        );
      case 4:
        return (
          <StepToneOfVoice
            value={formData.tone_of_voice}
            custom={formData.tone_custom}
            onChange={(tone, custom) =>
              update({ tone_of_voice: tone, tone_custom: custom ?? "" })
            }
          />
        );
      case 5:
        return (
          <StepCTAChannel
            value={formData.cta_channel}
            onChange={(v) => update({ cta_channel: v })}
          />
        );
      case 6:
        return (
          <StepCompetitors
            value={formData.competitors}
            onChange={(v) => update({ competitors: v })}
          />
        );
      case 7:
        return (
          <StepReview
            formData={formData}
            error={submitError}
            onEditStep={(s) => {
              setDirection("back");
              setStep(s);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#f8f5ef" }}
    >
      {/* ─── Progress bar ─── */}
      <div className="w-full h-[2px]" style={{ backgroundColor: "#e4e0d8" }}>
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, backgroundColor: "#0a0a0a" }}
        />
      </div>

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        {/* Back button */}
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm transition-all duration-200"
          style={{
            color: "#8c8880",
            fontFamily: "var(--font-body)",
            opacity: step === 0 ? 0 : 1,
            pointerEvents: step === 0 ? "none" : "auto",
          }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Voltar
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="logo-glow">
            <Image
              src="/logo.webp"
              alt="Postable"
              width={26}
              height={26}
              className="rounded-lg"
            />
          </div>
          <span
            className="font-semibold text-[15px] tracking-tight"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Postable
          </span>
        </div>

        {/* Step counter */}
        <span
          className="text-sm tabular-nums"
          style={{ color: "#8c8880", fontFamily: "var(--font-body)" }}
        >
          {step + 1}/{TOTAL_STEPS}
        </span>
      </div>

      {/* ─── Step dots ─── */}
      <div className="flex items-center justify-center gap-1.5 py-2">
        {STEP_TITLES.map((_, i) => (
          <div
            key={i}
            className="transition-all duration-300 rounded-full"
            style={{
              width: i === step ? "20px" : "6px",
              height: "6px",
              backgroundColor:
                i < step
                  ? "#0a0a0a"
                  : i === step
                  ? "#0a0a0a"
                  : "#e4e0d8",
            }}
          />
        ))}
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div
          key={`${step}-${direction}`}
          className={
            direction === "forward"
              ? "animate-step-in w-full max-w-xl"
              : "animate-step-in-back w-full max-w-xl"
          }
        >
          {renderStep()}
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="px-6 py-8 flex flex-col items-center gap-3">
        {step === 6 && (
          <button
            onClick={goNext}
            className="text-sm underline-offset-4 hover:underline transition-colors"
            style={{
              color: "#8c8880",
              fontFamily: "var(--font-body)",
            }}
          >
            Pular esta etapa
          </button>
        )}

        <button
          onClick={goNext}
          disabled={!ready || isLoading}
          className="flex items-center gap-2 px-10 py-3.5 rounded-full text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-35"
          style={{
            backgroundColor: "#0a0a0a",
            color: "#f8f5ef",
            fontFamily: "var(--font-body)",
            minWidth: "180px",
            justifyContent: "center",
          }}
        >
          {isLoading ? (
            <>
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{
                  borderColor: "rgba(248,245,239,0.3)",
                  borderTopColor: "#f8f5ef",
                }}
              />
              Criando...
            </>
          ) : step === TOTAL_STEPS - 1 ? (
            <>
              <Check size={15} strokeWidth={2.5} />
              Criar minha marca
            </>
          ) : (
            <>
              Continuar
              <ArrowRight size={15} strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
