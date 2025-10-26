"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedStandard, setSelectedStandard] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("us");
  const [analysisName, setAnalysisName] = useState("");
  const [analysisDescription, setAnalysisDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const progressStepsRef = useRef<HTMLDivElement>(null);

  const handleChatClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setTimeout(() => setShowForm(true), 500);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") {
      setUploadedFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const analysisSteps = [
    { id: 1, name: "Parsing document structure", duration: 800 },
    { id: 2, name: "Extracting compliance requirements", duration: 1000 },
    { id: 3, name: "Mapping regulatory framework", duration: 900 },
    { id: 4, name: "Cross-referencing regulations", duration: 1100 },
    { id: 5, name: "Generating compliance report", duration: 0 }, // stays until complete
  ];

  const handleSubmit = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setCurrentStep(0);

    // Scroll to progress steps after a short delay to allow rendering
    setTimeout(() => {
      progressStepsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);

    try {
      // Simulate step progression
      for (let i = 0; i < analysisSteps.length - 1; i++) {
        setCurrentStep(i + 1);
        await new Promise((resolve) =>
          setTimeout(resolve, analysisSteps[i]?.duration || 1000),
        );
      }

      // Start last step
      setCurrentStep(analysisSteps.length);

      // Create FormData to send PDF to backend
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("country", "USA");
      formData.append("top_k", "10");
      formData.append("num_chunks", "12");
      formData.append("compliance_focus", selectedStandard);

      // Send to backend for compliance checking
      const response = await fetch(
        "http://localhost:8000/api/regulations/check-pdf-compliance",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to analyze PDF");
      }

      const result = await response.json();

      // Store compliance results in sessionStorage
      sessionStorage.setItem("complianceResults", JSON.stringify(result));

      // Convert PDF to Markdown for display
      const markdownFormData = new FormData();
      markdownFormData.append("file", uploadedFile);

      const markdownResponse = await fetch(
        "http://localhost:8000/api/regulations/pdf-to-markdown",
        {
          method: "POST",
          body: markdownFormData,
        },
      );

      if (markdownResponse.ok) {
        const markdownResult = await markdownResponse.json();
        sessionStorage.setItem("originalMarkdown", markdownResult.markdown);
      }

      // Store file info and actual file data in sessionStorage
      sessionStorage.setItem("uploadedFileName", uploadedFile.name);
      sessionStorage.setItem("uploadedFileSize", uploadedFile.size.toString());

      // Convert file to base64 and store for later use
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        sessionStorage.setItem("uploadedFileData", base64data);
      };
      reader.readAsDataURL(uploadedFile);

      // Navigate to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Error analyzing PDF:", error);
      setAnalysisError(
        error instanceof Error ? error.message : "Failed to analyze PDF",
      );
      setCurrentStep(0);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0a0a0f]">
      {/* Animated background gradients */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-br from-blue-950/20 via-transparent to-purple-950/20" />
        <div className="animated-gradient absolute inset-0" />
      </div>

      {/* Logo - always show */}
      <div className="fixed top-6 left-6 z-50">
        <div className="w-[120px]">
          <Image
            src="/full-logo.png"
            alt="Harmoniq Logo"
            width={120}
            height={40}
            className="h-10 w-[120px] object-contain"
            quality={100}
            unoptimized
          />
        </div>
      </div>

      {/* Profile - always show */}
      <div className="fixed top-6 right-6 z-50">
        <div className="h-10 w-10 overflow-hidden rounded-full border border-blue-500/15 bg-[#0a0f1e] transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-600/10">
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-blue-400">
            JP
          </div>
        </div>
      </div>

      {/* Welcome Message - only show when not expanded */}
      {!isExpanded && (
        <div className="animate-in fade-in slide-in-from-bottom-4 absolute inset-x-0 top-[30%] text-center duration-700">
          <h1 className="mb-6 text-6xl font-bold text-white">
            Hello, Johnson!
          </h1>
          <p className="mb-2 text-xl text-gray-300">
            I'm here to help you fast track compliance.
          </p>
          {/* <p className="mb-8 text-base text-gray-500">
            Let's compare regulatory excerpts against clinical documents.
          </p> */}
        </div>
      )}

      {/* Analysis Name & Description Interface */}
      <div
        className={`${
          isExpanded
            ? "absolute top-6 left-1/2 w-full max-w-4xl -translate-x-1/2"
            : "absolute top-[55%] left-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2"
        } px-6 transition-all duration-700 ease-out`}
      >
        <div
          onClick={handleChatClick}
          className={`glass-morphic-strong blue-glow-hover ${
            isExpanded ? "rounded-2xl" : "cursor-pointer rounded-2xl"
          } overflow-hidden transition-all duration-500`}
        >
          {!isExpanded ? (
            <div className="flex items-center gap-3 px-4 py-2.5">
              <input
                type="text"
                placeholder="What are you looking to analyze..."
                className="flex-1 cursor-text bg-transparent text-sm text-white placeholder-gray-400 outline-none"
                onFocus={handleChatClick}
              />
              <button className="group hover:blue-glow cursor-pointer rounded-lg bg-transparent p-1.5 text-blue-400 transition-all duration-300 hover:bg-blue-600/20">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 transition-all duration-300 group-hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Regulatory Analysis Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Phase III Oncology Trial Protocol"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                />
              </div>
              <div className="h-px bg-blue-500/10"></div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-400">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Brief description of the analysis scope..."
                  value={analysisDescription}
                  onChange={(e) => setAnalysisDescription(e.target.value)}
                  rows={2}
                  className="w-full resize-none bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Section - shows after expansion */}
      {showForm && (
        <div className="animate-in slide-in-from-top-4 absolute top-56 left-1/2 w-full max-w-4xl -translate-x-1/2 px-6 pb-12 duration-700">
          <div className="rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 p-8 backdrop-blur-xl">
            <h3 className="mb-8 text-xl font-semibold text-white">
              Upload Clinical Document
            </h3>

            {/* File Upload */}
            <div className="mb-8">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onClick={handleFileClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="group hover:blue-glow flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-blue-500/20 bg-blue-600/5 p-12 transition-all duration-300 hover:border-blue-500/50 hover:bg-blue-600/10"
              >
                {uploadedFile ? (
                  <div className="text-center">
                    <svg
                      className="mx-auto mb-4 h-16 w-16 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="mb-1 text-base font-medium text-white">
                      {uploadedFile.name}
                    </p>
                    <p className="text-sm text-gray-400">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                      }}
                      className="mt-3 cursor-pointer text-xs text-red-400 hover:text-red-300"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg
                      className="mx-auto mb-4 h-16 w-16 text-blue-400/70 transition-all duration-300 group-hover:scale-110 group-hover:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="mb-1 text-base font-medium text-gray-200">
                      Click to upload or drag and drop
                    </p>
                    <p className="mb-2 text-sm text-gray-400">
                      ICF / SAP / CSR / Protocol
                    </p>
                    <p className="text-xs text-gray-500">PDF up to 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Compliance Region Selection */}
            <div className="mb-8">
              <label className="mb-4 block text-sm font-medium text-gray-300">
                Compliance Region
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setSelectedRegion("us")}
                  className={`group hover:blue-glow flex cursor-pointer flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    selectedRegion === "us"
                      ? "border-blue-500/40 bg-blue-600/10"
                      : "border-blue-500/20 bg-transparent hover:border-blue-500/40 hover:bg-blue-600/5"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedRegion === "us"
                          ? "border-blue-400 bg-blue-600/20"
                          : "border-gray-500"
                      }`}
                    >
                      {selectedRegion === "us" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      US (FDA)
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight text-gray-400">
                    Food and Drug Administration
                  </p>
                </button>

                <button
                  onClick={() => setSelectedRegion("europe")}
                  className={`group hover:blue-glow flex cursor-pointer flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    selectedRegion === "europe"
                      ? "border-blue-500/40 bg-blue-600/10"
                      : "border-blue-500/20 bg-transparent hover:border-blue-500/40 hover:bg-blue-600/5"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedRegion === "europe"
                          ? "border-blue-400 bg-blue-600/20"
                          : "border-gray-500"
                      }`}
                    >
                      {selectedRegion === "europe" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      Europe (EMA)
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight text-gray-400">
                    European Medicines Agency
                  </p>
                </button>

                <button
                  onClick={() => setSelectedRegion("japan")}
                  className={`group hover:blue-glow flex cursor-pointer flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    selectedRegion === "japan"
                      ? "border-blue-500/40 bg-blue-600/10"
                      : "border-blue-500/20 bg-transparent hover:border-blue-500/40 hover:bg-blue-600/5"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedRegion === "japan"
                          ? "border-blue-400 bg-blue-600/20"
                          : "border-gray-500"
                      }`}
                    >
                      {selectedRegion === "japan" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      Japan (PMDA)
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight text-gray-400">
                    Pharmaceuticals and Medical Devices Agency
                  </p>
                </button>
              </div>
            </div>

            {/* Compliance Category Selection */}
            <div className="mb-8">
              <label className="mb-4 block text-sm font-medium text-gray-300">
                Select Compliance Focus
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedStandard("all")}
                  className={`group hover:blue-glow flex cursor-pointer flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    selectedStandard === "all"
                      ? "border-blue-500/40 bg-blue-600/10"
                      : "border-blue-500/20 bg-transparent hover:border-blue-500/40 hover:bg-blue-600/5"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedStandard === "all"
                          ? "border-blue-400 bg-blue-600/20"
                          : "border-gray-500"
                      }`}
                    >
                      {selectedStandard === "all" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      All Standards
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight text-gray-400">
                    Full compliance sweep across all standards
                  </p>
                </button>

                <button
                  onClick={() => setSelectedStandard("consent")}
                  className={`group hover:blue-glow flex cursor-pointer flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    selectedStandard === "consent"
                      ? "border-blue-500/40 bg-blue-600/10"
                      : "border-blue-500/20 bg-transparent hover:border-blue-500/40 hover:bg-blue-600/5"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedStandard === "consent"
                          ? "border-blue-400 bg-blue-600/20"
                          : "border-gray-500"
                      }`}
                    >
                      {selectedStandard === "consent" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      Informed Consent
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight text-gray-400">
                    Ensuring participants understand study risks and rights
                  </p>
                </button>

                <button
                  onClick={() => setSelectedStandard("data")}
                  className={`group hover:blue-glow flex cursor-pointer flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    selectedStandard === "data"
                      ? "border-blue-500/40 bg-blue-600/10"
                      : "border-blue-500/20 bg-transparent hover:border-blue-500/40 hover:bg-blue-600/5"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedStandard === "data"
                          ? "border-blue-400 bg-blue-600/20"
                          : "border-gray-500"
                      }`}
                    >
                      {selectedStandard === "data" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      Data Integrity
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight text-gray-400">
                    Maintaining accuracy and reliability of clinical data
                  </p>
                </button>

                <button
                  onClick={() => setSelectedStandard("safety")}
                  className={`group hover:blue-glow flex cursor-pointer flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-300 ${
                    selectedStandard === "safety"
                      ? "border-blue-500/40 bg-blue-600/10"
                      : "border-blue-500/20 bg-transparent hover:border-blue-500/40 hover:bg-blue-600/5"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedStandard === "safety"
                          ? "border-blue-400 bg-blue-600/20"
                          : "border-gray-500"
                      }`}
                    >
                      {selectedStandard === "safety" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      Safety & Reporting
                    </span>
                  </div>
                  <p className="text-[10px] leading-tight text-gray-400">
                    Monitoring adverse events and regulatory reporting
                  </p>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {analysisError && (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-center gap-2 text-red-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm">{analysisError}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!uploadedFile || isAnalyzing}
              className={`group mt-2 w-full cursor-pointer rounded-xl border px-6 py-4 text-base font-semibold transition-all duration-300 ${
                uploadedFile && !isAnalyzing
                  ? "hover:blue-glow border-blue-500/30 bg-transparent text-blue-400 hover:border-blue-500/60 hover:bg-blue-600/20 hover:text-blue-300"
                  : "cursor-not-allowed border-gray-600/30 bg-transparent text-gray-600"
              }`}
            >
              {isAnalyzing ? (
                <span className="inline-flex items-center gap-3">
                  <svg
                    className="h-5 w-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Analyzing PDF...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 transition-all duration-300 group-hover:scale-105">
                  Analyze Compliance
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              )}
            </button>

            {/* Progress Steps - Vercel Style */}
            {isAnalyzing && (
              <div
                ref={progressStepsRef}
                className="animate-in slide-in-from-bottom-4 mt-6 overflow-hidden rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 backdrop-blur-xl duration-500"
              >
                <div className="border-b border-blue-500/10 bg-blue-500/5 px-5 py-3">
                  <h4 className="text-sm font-semibold text-white">
                    Running Compliance Analysis
                  </h4>
                  <p className="text-xs text-gray-400">
                    Processing your document...
                  </p>
                </div>
                <div className="p-5">
                  <div className="space-y-3">
                    {analysisSteps.map((step, index) => {
                      const stepNumber = index + 1;
                      const isCompleted = currentStep > stepNumber;
                      const isActive = currentStep === stepNumber;
                      const isPending = currentStep < stepNumber;

                      return (
                        <div
                          key={step.id}
                          className={`flex items-start gap-3 transition-all duration-300 ${
                            isActive
                              ? "opacity-100"
                              : isCompleted
                                ? "opacity-60"
                                : "opacity-30"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isCompleted ? (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 ring-2 ring-green-500/50">
                                <svg
                                  className="h-3 w-3 text-green-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            ) : isActive ? (
                              <div className="relative flex h-5 w-5 items-center justify-center">
                                <div className="absolute h-5 w-5 animate-ping rounded-full bg-blue-400/30"></div>
                                <div className="relative h-2.5 w-2.5 rounded-full bg-blue-400"></div>
                              </div>
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-600/50 bg-gray-600/10">
                                <div className="h-1.5 w-1.5 rounded-full bg-gray-600/50"></div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 pt-0.5">
                            <p
                              className={`text-sm font-medium ${
                                isActive
                                  ? "text-blue-300"
                                  : isCompleted
                                    ? "text-gray-400"
                                    : "text-gray-600"
                              }`}
                            >
                              {step.name}
                            </p>
                          </div>
                          {isActive && (
                            <div className="mt-1">
                              <svg
                                className="h-4 w-4 animate-spin text-blue-400"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
