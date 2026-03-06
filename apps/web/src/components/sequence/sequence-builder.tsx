"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const stepSchema = z.object({
  stepNumber: z.number(),
  subject: z.string().min(1, "Subject required"),
  subjectB: z.string().optional(),
  body: z.string().min(1, "Body required"),
  delayDays: z.coerce.number().min(0),
  plainText: z.boolean().default(false),
});

const formSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  steps: z.array(stepSchema).min(1, "At least 1 step required"),
});

export type SequenceFormData = z.infer<typeof formSchema>;

const VARS = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{title}}"];

interface Props {
  defaultValues?: Partial<SequenceFormData>;
  onSubmit: (data: SequenceFormData) => void;
  loading?: boolean;
}

export function SequenceBuilder({ defaultValues, onSubmit, loading }: Props) {
  const [expandedStep, setExpandedStep] = useState<number>(0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<SequenceFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues ?? {
      name: "",
      steps: [{ stepNumber: 1, subject: "", body: "", delayDays: 0, plainText: false }],
    },
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: "steps" });

  const steps = watch("steps");

  const addStep = () => {
    const nextNum = (steps[steps.length - 1]?.stepNumber ?? 0) + 1;
    append({ stepNumber: nextNum, subject: "", body: "", delayDays: 3, plainText: false });
    setExpandedStep(fields.length);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Sequence info */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label htmlFor="name">Sequence name</Label>
            <Input
              id="name"
              {...register("name")}
              className="mt-1.5"
              placeholder="Outbound SaaS founders"
            />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              {...register("description")}
              className="mt-1.5"
              placeholder="Short description"
            />
          </div>
        </CardContent>
      </Card>

      {/* Variable reference */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-[#444]">Variables:</span>
        {VARS.map((v) => (
          <code key={v} className="text-[10px] font-mono bg-[rgba(255,255,255,0.04)] text-[#D4924A] px-1.5 py-0.5 rounded">
            {v}
          </code>
        ))}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {fields.map((field, i) => {
          const isExpanded = expandedStep === i;
          const delay = steps[i]?.delayDays;

          return (
            <Card
              key={field.id}
              className={cn(
                "transition-colors",
                isExpanded && "border-[rgba(255,255,255,0.1)]"
              )}
            >
              {/* Step header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpandedStep(isExpanded ? -1 : i)}
              >
                <div className="text-[#333] cursor-grab">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-mono text-[#D4924A] min-w-[1.5rem]">
                    #{i + 1}
                  </span>
                  <span className="text-sm text-[#EDEDED] truncate">
                    {steps[i]?.subject || <span className="text-[#444]">No subject</span>}
                  </span>
                  {i > 0 && delay !== undefined && (
                    <span className="text-xs text-[#444] ml-2">
                      +{delay}d
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (fields.length > 1) remove(i);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#444]" />
                  </Button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-[#444]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#444]" />
                  )}
                </div>
              </div>

              {/* Step body */}
              {isExpanded && (
                <CardContent className="px-4 pb-5 pt-0 space-y-4 border-t border-[rgba(255,255,255,0.05)]">
                  {i > 0 && (
                    <div>
                      <Label>Wait (days)</Label>
                      <Input
                        type="number"
                        {...register(`steps.${i}.delayDays`)}
                        className="mt-1.5 w-24"
                        min={0}
                      />
                    </div>
                  )}

                  <div>
                    <Label>Subject line</Label>
                    <Input
                      {...register(`steps.${i}.subject`)}
                      className="mt-1.5"
                      placeholder="Quick question, {{first_name}}"
                    />
                    {errors.steps?.[i]?.subject && (
                      <p className="text-xs text-red-400 mt-1">
                        {errors.steps[i]?.subject?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Subject B (A/B test)</Label>
                    <Input
                      {...register(`steps.${i}.subjectB`)}
                      className="mt-1.5"
                      placeholder="Optional alternate subject"
                    />
                  </div>

                  <div>
                    <Label>Email body</Label>
                    <Textarea
                      {...register(`steps.${i}.body`)}
                      className="mt-1.5 min-h-[180px] font-mono text-xs"
                      placeholder={`Hi {{first_name}},\n\nI noticed that {{company}}...\n\nBest,\nAlex`}
                    />
                    {errors.steps?.[i]?.body && (
                      <p className="text-xs text-red-400 mt-1">
                        {errors.steps[i]?.body?.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`plainText-${i}`}
                      {...register(`steps.${i}.plainText`)}
                      className="accent-[#D4924A]"
                    />
                    <Label htmlFor={`plainText-${i}`} className="cursor-pointer">
                      Plain text only (no HTML)
                    </Label>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add step */}
      <Button type="button" variant="outline" onClick={addStep} className="w-full">
        <Plus className="h-3.5 w-3.5" />
        Add step
      </Button>

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Save sequence
        </Button>
      </div>
    </form>
  );
}
