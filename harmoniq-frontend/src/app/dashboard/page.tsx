"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"diffs" | "graph">("diffs");
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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

  const complianceItems = [
    {
      id: 1,
      status: "pass",
      requirement: "Informed consent must include study purpose and duration",
      citation: "21 CFR 50.25(a)(1)",
      location: "Section 2.1, Page 3",
      confidence: 98,
    },
    {
      id: 2,
      status: "warn",
      requirement: "Description of reasonably foreseeable risks or discomforts",
      citation: "21 CFR 50.25(a)(2)",
      location: "Section 4.2, Page 7",
      confidence: 72,
    },
    {
      id: 3,
      status: "fail",
      requirement:
        "Alternative procedures or courses of treatment must be disclosed",
      citation: "21 CFR 50.25(a)(4)",
      location: "Missing",
      confidence: 95,
    },
    {
      id: 4,
      status: "pass",
      requirement: "Confidentiality statement and limits clearly defined",
      citation: "21 CFR 50.25(a)(5)",
      location: "Section 8.1, Page 12",
      confidence: 96,
    },
    {
      id: 5,
      status: "warn",
      requirement:
        "Contact information for questions about research and rights",
      citation: "21 CFR 50.25(a)(7)",
      location: "Section 9.3, Page 14",
      confidence: 68,
    },
    {
      id: 6,
      status: "pass",
      requirement: "Statement that participation is voluntary",
      citation: "21 CFR 50.25(a)(8)",
      location: "Section 1.2, Page 2",
      confidence: 99,
    },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0f]">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-br from-blue-950/20 via-transparent to-purple-950/20" />
        <div className="animated-gradient absolute inset-0" />
      </div>

      {/* Top Navigation Bar */}
      <nav className="glass-morphic-strong fixed top-0 right-0 left-0 z-50 border-b border-blue-500/20">
        <div className="mx-auto flex h-20 max-w-screen-2xl items-center justify-between px-6">
          {/* Logo */}
          <div>
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

          {/* Search Bar */}
          <div className="flex-1 px-8">
            <div className="glass-morphic blue-glow-hover relative max-w-2xl rounded-xl transition-all duration-300">
              <input
                type="text"
                placeholder="Search regulations, requirements, or citations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full cursor-text bg-transparent px-6 py-3 text-sm text-white placeholder-gray-400 outline-none"
              />
              <svg
                className="absolute top-1/2 right-4 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
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
                    <p className="text-sm font-semibold text-white">
                      John Paul
                    </p>
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
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-6 pt-24">
        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel - PDF Viewer */}
          <div className="glass-morphic-strong h-[calc(100vh-7rem)] overflow-hidden rounded-2xl">
            <div className="border-b border-blue-500/20 p-4">
              <h2 className="text-lg font-semibold text-white">
                Clinical Document
              </h2>
              <p className="text-sm text-gray-400">
                informed_consent_form_v3.pdf
              </p>
            </div>
            <div className="h-full overflow-y-auto p-6">
              {/* PDF Preview Placeholder */}
              <div className="glass-morphic space-y-4 rounded-xl p-8">
                <div className="mb-6 flex items-center justify-between border-b border-blue-500/20 pb-4">
                  <h3 className="text-xl font-bold text-white">
                    Informed Consent Form
                  </h3>
                  <span className="rounded-full bg-blue-600/30 px-3 py-1 text-xs text-blue-300">
                    Version 3.2
                  </span>
                </div>

                <div className="space-y-4 text-gray-300">
                  <p className="leading-relaxed">
                    <span className="font-semibold text-blue-400">
                      Section 1: Introduction
                    </span>
                    <br />
                    You are being asked to participate in a clinical research
                    study. This consent form provides information about the
                    study. Please read this form carefully.
                  </p>

                  <p className="leading-relaxed">
                    <span className="font-semibold text-blue-400">
                      Section 2: Study Purpose and Duration
                    </span>
                    <br />
                    The purpose of this study is to evaluate the safety and
                    efficacy of the investigational drug XYZ-123 in patients
                    with condition ABC. Your participation will last
                    approximately 12 months.
                  </p>

                  <p className="leading-relaxed">
                    <span className="font-semibold text-blue-400">
                      Section 4: Risks and Discomforts
                    </span>
                    <br />
                    Possible risks include mild headache, nausea, and fatigue.
                    Some participants may experience more serious side effects.
                  </p>

                  <p className="leading-relaxed">
                    <span className="font-semibold text-blue-400">
                      Section 8: Confidentiality
                    </span>
                    <br />
                    Your personal information will be kept confidential.
                    However, regulatory authorities may review your records as
                    required by law.
                  </p>

                  <div className="mt-8 rounded-lg bg-blue-600/10 p-4">
                    <p className="text-sm text-blue-300">
                      📄 Analyzing against 21 CFR Part 50 requirements...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Diffs/Graph View */}
          <div className="glass-morphic-strong h-[calc(100vh-7rem)] overflow-hidden rounded-2xl">
            {/* Tab Switcher */}
            <div className="border-b border-blue-500/20 p-4">
              <div className="glass-morphic inline-flex rounded-xl p-1">
                <button
                  onClick={() => setActiveTab("diffs")}
                  className={`cursor-pointer rounded-lg px-6 py-2 text-sm font-medium transition-all duration-300 ${
                    activeTab === "diffs"
                      ? "blue-glow border border-blue-500/60 bg-blue-600/20 text-blue-300"
                      : "border border-transparent bg-transparent text-gray-400 hover:border-blue-500/40 hover:bg-blue-600/10 hover:text-white"
                  }`}
                >
                  Compliance Checklist
                </button>
                <button
                  onClick={() => setActiveTab("graph")}
                  className={`cursor-pointer rounded-lg px-6 py-2 text-sm font-medium transition-all duration-300 ${
                    activeTab === "graph"
                      ? "blue-glow border border-blue-500/60 bg-blue-600/20 text-blue-300"
                      : "border border-transparent bg-transparent text-gray-400 hover:border-blue-500/40 hover:bg-blue-600/10 hover:text-white"
                  }`}
                >
                  Summary
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="h-full overflow-y-auto p-6">
              {activeTab === "diffs" ? (
                <div className="space-y-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      Regulatory Compliance
                    </h3>
                    <button className="group hover:blue-glow cursor-pointer rounded-lg border border-blue-500/30 bg-transparent px-4 py-2 text-sm text-blue-400 transition-all duration-300 hover:border-blue-500/60 hover:bg-blue-600/20">
                      Export ICF Update Pack
                    </button>
                  </div>

                  {complianceItems.map((item) => (
                    <div
                      key={item.id}
                      className="glass-morphic group hover:blue-glow rounded-xl p-4 transition-all duration-300"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              item.status === "pass"
                                ? "bg-green-600/20 text-green-400"
                                : item.status === "warn"
                                  ? "bg-yellow-600/20 text-yellow-400"
                                  : "bg-red-600/20 text-red-400"
                            }`}
                          >
                            {item.status === "pass"
                              ? "✓"
                              : item.status === "warn"
                                ? "⚠"
                                : "✕"}
                          </div>
                          <div className="flex-1">
                            <p className="mb-1 text-sm font-medium text-white">
                              {item.requirement}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                              <span className="rounded bg-blue-600/20 px-2 py-0.5 font-mono text-blue-300">
                                {item.citation}
                              </span>
                              <span>→ {item.location}</span>
                              <span className="text-gray-500">
                                {item.confidence}% confidence
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="opacity-0 transition-opacity group-hover:opacity-100">
                          <button className="cursor-pointer rounded-lg border border-blue-500/30 bg-transparent px-3 py-1 text-xs text-blue-400 transition-all hover:border-blue-500/60 hover:bg-blue-600/20">
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="glass-morphic mt-6 rounded-xl p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">
                        Compliance Summary
                      </h4>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-400">3</p>
                        <p className="text-xs text-gray-400">Passed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-400">2</p>
                        <p className="text-xs text-gray-400">Warnings</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-400">1</p>
                        <p className="text-xs text-gray-400">Failed</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-white">
                    Analysis Summary
                  </h3>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-morphic hover:blue-glow rounded-xl border border-blue-500/20 p-6 transition-all duration-300 hover:border-blue-500/40">
                      <p className="mb-1 text-sm text-gray-400">
                        Requirements Checked
                      </p>
                      <p className="text-3xl font-bold text-white">6</p>
                    </div>
                    <div className="glass-morphic hover:blue-glow rounded-xl border border-blue-500/20 p-6 transition-all duration-300 hover:border-blue-500/40">
                      <p className="mb-1 text-sm text-gray-400">
                        Compliance Rate
                      </p>
                      <p className="text-3xl font-bold text-yellow-400">50%</p>
                    </div>
                    <div className="glass-morphic hover:blue-glow rounded-xl border border-blue-500/20 p-6 transition-all duration-300 hover:border-blue-500/40">
                      <p className="mb-1 text-sm text-gray-400">
                        Avg Confidence
                      </p>
                      <p className="text-3xl font-bold text-green-400">88%</p>
                    </div>
                    <div className="glass-morphic hover:blue-glow rounded-xl border border-blue-500/20 p-6 transition-all duration-300 hover:border-blue-500/40">
                      <p className="mb-1 text-sm text-gray-400">
                        Analysis Time
                      </p>
                      <p className="text-3xl font-bold text-white">1.8s</p>
                    </div>
                  </div>

                  {/* Regulatory Coverage */}
                  <div className="glass-morphic rounded-xl p-6">
                    <h4 className="mb-4 text-sm font-semibold text-white">
                      Regulatory Coverage (21 CFR Part 50)
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-gray-400">
                            50.25(a)(1) - Purpose & Duration
                          </span>
                          <span className="text-green-400">100%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                          <div className="h-full w-full bg-linear-to-r from-green-600 to-green-400"></div>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-gray-400">
                            50.25(a)(2) - Risks
                          </span>
                          <span className="text-yellow-400">72%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                          <div className="h-full w-[72%] bg-linear-to-r from-yellow-600 to-yellow-400"></div>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-gray-400">
                            50.25(a)(4) - Alternatives
                          </span>
                          <span className="text-red-400">0%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                          <div className="h-full w-0 bg-linear-to-r from-red-600 to-red-400"></div>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-gray-400">
                            50.25(a)(5) - Confidentiality
                          </span>
                          <span className="text-green-400">96%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                          <div className="h-full w-[96%] bg-linear-to-r from-green-600 to-green-400"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
