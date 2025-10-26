"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function HomePage() {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedStandard, setSelectedStandard] = useState("all");
  const profileRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = () => {
    if (uploadedFile) {
      // Store file info in sessionStorage
      sessionStorage.setItem("uploadedFileName", uploadedFile.name);
      sessionStorage.setItem("uploadedFileSize", uploadedFile.size.toString());

      // Create object URL for the PDF
      const fileUrl = URL.createObjectURL(uploadedFile);
      sessionStorage.setItem("uploadedFileUrl", fileUrl);

      // Navigate to dashboard
      router.push("/dashboard");
    }
  };

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0f]">
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
      <div className="fixed top-6 right-6 z-50" ref={profileRef}>
        <button
          onClick={handleProfileClick}
          className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border border-blue-500/15 bg-[#0a0f1e] transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-600/10"
        >
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-blue-400">
            JP
          </div>
        </button>

        {/* Profile Dropdown Menu */}
        {showProfileMenu && (
          <div className="glass-morphic absolute top-14 right-0 w-56 overflow-hidden rounded-xl border border-blue-500/15">
            <div className="bg-[#0a0f1e]/90 p-2">
              <div className="border-b border-blue-500/10 px-4 py-3">
                <p className="text-sm font-semibold text-white">John Paul</p>
                <p className="text-xs text-gray-400">jp@harmoniq.ai</p>
              </div>
              <button className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm text-gray-300 transition-all hover:bg-blue-600/10 hover:text-white">
                Account Settings
              </button>
              <button className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm text-gray-300 transition-all hover:bg-blue-600/10 hover:text-white">
                Preferences
              </button>
              <button className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm text-gray-300 transition-all hover:bg-blue-600/10 hover:text-white">
                Documentation
              </button>
              <div className="my-1 border-t border-blue-500/10"></div>
              <button className="w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm text-red-400 transition-all hover:bg-red-600/10 hover:text-red-300">
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Welcome Message - only show when not expanded */}
      {!isExpanded && (
        <div className="animate-in fade-in slide-in-from-bottom-4 absolute inset-x-0 top-[30%] text-center duration-700">
          <h1 className="mb-6 text-6xl font-bold text-white">
            Welcome back, John!
          </h1>
          <p className="mb-2 text-xl text-gray-300">
            Regulatory Intelligence Agent
          </p>
          <p className="mb-8 text-base text-gray-500">
            Compare regulatory excerpts against clinical documents
          </p>
        </div>
      )}

      {/* Chat Interface */}
      <div
        className={`${
          isExpanded
            ? "fixed top-6 left-1/2 w-full max-w-4xl -translate-x-1/2"
            : "absolute top-[55%] left-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2"
        } px-6 transition-all duration-700 ease-out`}
      >
        <div
          onClick={handleChatClick}
          className={`glass-morphic-strong blue-glow-hover ${
            isExpanded ? "rounded-2xl" : "cursor-pointer rounded-2xl"
          } overflow-hidden transition-all duration-500`}
        >
          <div className="flex items-center gap-3 px-4 py-2.5">
            <input
              type="text"
              placeholder="What site are you looking to check compliance for..."
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
        </div>
      </div>

      {/* Form Section - shows after expansion */}
      {showForm && (
        <div className="animate-in slide-in-from-top-4 fixed top-24 left-1/2 w-full max-w-4xl -translate-x-1/2 px-6 duration-700">
          <div className="rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 p-6 backdrop-blur-xl">
            <h3 className="mb-6 text-xl font-semibold text-white">
              Upload Clinical Document
            </h3>

            {/* File Upload */}
            <div className="mb-6">
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

            {/* Compliance Category Selection */}
            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium text-gray-300">
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
                    Full compliance sweep across FDA, EMA, ICH-GCP
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
                    21 CFR Part 50 / ICH E6 §4 compliance
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
                    21 CFR Part 11 / Annex 11 systems
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
                    21 CFR Part 312 / EU CTR 536/2014
                  </p>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!uploadedFile}
              className={`group mt-2 w-full cursor-pointer rounded-xl border px-6 py-4 text-base font-semibold transition-all duration-300 ${
                uploadedFile
                  ? "hover:blue-glow border-blue-500/30 bg-transparent text-blue-400 hover:border-blue-500/60 hover:bg-blue-600/20 hover:text-blue-300"
                  : "cursor-not-allowed border-gray-600/30 bg-transparent text-gray-600"
              }`}
            >
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
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
