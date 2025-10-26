"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
// @ts-ignore - d3-force types not required for build
import * as d3 from "d3-force";
import * as THREE from "three";

// Dynamically import ForceGraph3D to avoid SSR issues
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});

interface NodeData {
  id: string;
  title: string;
  type: "pass" | "warn" | "fail";
  requirement: string;
  citation: string;
  location: string;
  confidence: number;
  size: "small" | "medium" | "large";
  connections: string[];
}

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
  nodeData: NodeData;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string;
  target: string;
  color: string;
  width: number;
}

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [complianceFilter, setComplianceFilter] = useState<
    "all" | "pass" | "warn" | "fail"
  >("all");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  // Load PDF from sessionStorage
  useEffect(() => {
    const storedUrl = sessionStorage.getItem("uploadedFileUrl");
    const storedName = sessionStorage.getItem("uploadedFileName");
    if (storedUrl) setPdfUrl(storedUrl);
    if (storedName) setFileName(storedName);
  }, []);
  const [nodes] = useState<NodeData[]>([
    {
      id: "req-1",
      title: "Study Purpose",
      type: "pass",
      requirement: "Informed consent must include study purpose and duration",
      citation: "21 CFR 50.25(a)(1)",
      location: "Section 2.1, Page 3",
      confidence: 98,
      size: "large",
      connections: ["req-2", "req-6", "req-8"],
    },
    {
      id: "req-2",
      title: "Risk Disclosure",
      type: "warn",
      requirement: "Description of reasonably foreseeable risks or discomforts",
      citation: "21 CFR 50.25(a)(2)",
      location: "Section 4.2, Page 7",
      confidence: 72,
      size: "medium",
      connections: ["req-1", "req-3", "req-7"],
    },
    {
      id: "req-3",
      title: "Alternatives",
      type: "fail",
      requirement:
        "Alternative procedures or courses of treatment must be disclosed",
      citation: "21 CFR 50.25(a)(4)",
      location: "Missing",
      confidence: 95,
      size: "large",
      connections: ["req-2", "req-4"],
    },
    {
      id: "req-4",
      title: "Confidentiality",
      type: "pass",
      requirement: "Confidentiality statement and limits clearly defined",
      citation: "21 CFR 50.25(a)(5)",
      location: "Section 8.1, Page 12",
      confidence: 96,
      size: "medium",
      connections: ["req-3", "req-5", "req-9"],
    },
    {
      id: "req-5",
      title: "Contact Info",
      type: "warn",
      requirement:
        "Contact information for questions about research and rights",
      citation: "21 CFR 50.25(a)(7)",
      location: "Section 9.3, Page 14",
      confidence: 68,
      size: "small",
      connections: ["req-4", "req-6"],
    },
    {
      id: "req-6",
      title: "Voluntary Participation",
      type: "pass",
      requirement: "Statement that participation is voluntary",
      citation: "21 CFR 50.25(a)(8)",
      location: "Section 1.2, Page 2",
      confidence: 99,
      size: "large",
      connections: ["req-1", "req-5", "req-10"],
    },
    {
      id: "req-7",
      title: "Benefits",
      type: "pass",
      requirement: "Description of anticipated benefits to the subject",
      citation: "21 CFR 50.25(a)(3)",
      location: "Section 3.1, Page 5",
      confidence: 88,
      size: "medium",
      connections: ["req-2", "req-8"],
    },
    {
      id: "req-8",
      title: "Compensation",
      type: "warn",
      requirement:
        "Disclosure of compensation and medical treatments available",
      citation: "21 CFR 50.25(a)(6)",
      location: "Section 7.4, Page 10",
      confidence: 75,
      size: "small",
      connections: ["req-1", "req-7", "req-9"],
    },
    {
      id: "req-9",
      title: "Right to Withdraw",
      type: "pass",
      requirement: "Statement about right to withdraw without penalty",
      citation: "21 CFR 50.25(a)(8)",
      location: "Section 1.5, Page 2",
      confidence: 94,
      size: "medium",
      connections: ["req-4", "req-8", "req-10"],
    },
    {
      id: "req-10",
      title: "IRB Approval",
      type: "pass",
      requirement: "Statement that protocol has been reviewed by IRB",
      citation: "21 CFR 56.109(e)",
      location: "Section 10.1, Page 15",
      confidence: 97,
      size: "medium",
      connections: ["req-6", "req-9"],
    },
    {
      id: "req-11",
      title: "Data Handling",
      type: "warn",
      requirement: "Description of how data will be collected and stored",
      citation: "ICH-GCP E6 4.8.10",
      location: "Section 8.3, Page 12",
      confidence: 70,
      size: "small",
      connections: ["req-4", "req-12"],
    },
    {
      id: "req-12",
      title: "Subject Responsibilities",
      type: "pass",
      requirement: "Clear statement of subject's responsibilities",
      citation: "ICH-GCP E6 4.8.5",
      location: "Section 5.2, Page 8",
      confidence: 91,
      size: "small",
      connections: ["req-11", "req-13"],
    },
    {
      id: "req-13",
      title: "Study Duration",
      type: "pass",
      requirement: "Expected duration of subject's participation",
      citation: "21 CFR 50.25(a)(1)",
      location: "Section 2.3, Page 4",
      confidence: 99,
      size: "small",
      connections: ["req-12", "req-1"],
    },
    {
      id: "req-14",
      title: "Costs to Subject",
      type: "fail",
      requirement: "Disclosure of costs subject may incur",
      citation: "21 CFR 50.25(b)(3)",
      location: "Missing",
      confidence: 88,
      size: "medium",
      connections: ["req-8", "req-15"],
    },
    {
      id: "req-15",
      title: "Injury Compensation",
      type: "warn",
      requirement: "Explanation of compensation for injury",
      citation: "21 CFR 50.25(a)(6)",
      location: "Section 7.1, Page 9",
      confidence: 65,
      size: "small",
      connections: ["req-14", "req-16"],
    },
    {
      id: "req-16",
      title: "Study Procedures",
      type: "pass",
      requirement: "Description of procedures to be followed",
      citation: "21 CFR 50.25(a)(1)",
      location: "Section 3.5, Page 6",
      confidence: 93,
      size: "medium",
      connections: ["req-15", "req-7"],
    },
    {
      id: "req-17",
      title: "Privacy Protection",
      type: "pass",
      requirement: "Statement about confidentiality of records",
      citation: "45 CFR 164.508",
      location: "Section 8.2, Page 11",
      confidence: 95,
      size: "small",
      connections: ["req-4", "req-11"],
    },
    {
      id: "req-18",
      title: "Unforeseeable Risks",
      type: "warn",
      requirement: "Statement about unforeseeable risks",
      citation: "21 CFR 50.25(b)(1)",
      location: "Section 4.5, Page 7",
      confidence: 60,
      size: "small",
      connections: ["req-2", "req-15"],
    },
    {
      id: "req-19",
      title: "Protocol Deviations",
      type: "fail",
      requirement: "Explanation of consequences of protocol deviations",
      citation: "ICH-GCP E6 4.8.9",
      location: "Missing",
      confidence: 92,
      size: "medium",
      connections: ["req-12", "req-9"],
    },
    {
      id: "req-20",
      title: "New Findings",
      type: "pass",
      requirement: "Statement about new findings disclosure",
      citation: "21 CFR 50.25(b)(5)",
      location: "Section 6.2, Page 9",
      confidence: 89,
      size: "small",
      connections: ["req-2", "req-18"],
    },
  ]);
  const [graphData, setGraphData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const graphRef = useRef<any>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphDimensions, setGraphDimensions] = useState({
    width: 800,
    height: 600,
  });

  const handleProfileClick = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  // Track container dimensions for proper graph centering
  useEffect(() => {
    const updateDimensions = () => {
      if (graphContainerRef.current) {
        setGraphDimensions({
          width: graphContainerRef.current.offsetWidth,
          height: graphContainerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

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

  // Configure force simulation after mount for 3D and center on main node
  useEffect(() => {
    if (
      graphRef.current &&
      graphData.nodes.length > 0 &&
      graphDimensions.width > 0
    ) {
      // Configure 3D forces with closer nodes
      graphRef.current.d3Force("charge", d3.forceManyBody().strength(-300)); // Reduced repulsion
      graphRef.current.d3Force(
        "link",
        d3.forceLink().distance(60).strength(0.4), // Shorter links, stronger pull
      );

      // Add center force to keep graph centered
      graphRef.current.d3Force("center", d3.forceCenter(0, 0, 0).strength(0.1));
      graphRef.current.d3Force("collision", d3.forceCollide().radius(35)); // Smaller collision

      // Load node positions from session storage or generate new ones
      const storageKey = "harmoniq-graph-positions";
      const cameraKey = "harmoniq-camera-position";
      let savedPositions: any = null;

      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          savedPositions = JSON.parse(saved);
        }
      } catch (error) {
        console.log("Could not load saved positions:", error);
      }

      // CLEAR old camera position to apply new settings
      // Remove this line after testing to keep camera position
      sessionStorage.removeItem(cameraKey);

      // Distribute nodes in 3D space - CLOSER TOGETHER and CENTERED
      const newPositions: any = {};
      graphData.nodes.forEach((node: any) => {
        // Try to load saved position
        if (savedPositions && savedPositions[node.id]) {
          node.x = savedPositions[node.id].x;
          node.y = savedPositions[node.id].y;
          node.z = savedPositions[node.id].z;
        } else {
          // Generate new positions - SMALLER SPREAD, CENTERED AT ORIGIN
          if (!node.z || node.z === 0) {
            node.z = (Math.random() - 0.5) * 120; // Even smaller spread
          }
          if (!node.y) {
            node.y = (Math.random() - 0.5) * 120; // Even smaller spread
          }
          if (!node.x) {
            node.x = (Math.random() - 0.5) * 120; // Even smaller spread
          }
        }

        // Save position for next time
        newPositions[node.id] = { x: node.x, y: node.y, z: node.z };
      });

      // Save positions to session storage
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(newPositions));
      } catch (error) {
        console.log("Could not save positions:", error);
      }

      // Center the entire graph and restore camera position if saved
      setTimeout(() => {
        if (graphRef.current) {
          // Just use zoomToFit to show all nodes properly
          graphRef.current.zoomToFit(1500, 50);

          // Save camera position whenever it changes
          const saveCamera = () => {
            if (graphRef.current) {
              const position = graphRef.current.cameraPosition();
              const camera = {
                position: position,
                lookAt: { x: 0, y: 0, z: 0 }, // Center of graph
              };
              try {
                sessionStorage.setItem(cameraKey, JSON.stringify(camera));
              } catch (error) {
                console.log("Could not save camera:", error);
              }
            }
          };

          // Save camera position periodically
          const saveInterval = setInterval(saveCamera, 1000);

          // Cleanup interval on unmount
          return () => clearInterval(saveInterval);
        }
      }, 500);
    }
  }, [graphData, graphDimensions]);

  // Generate graph data for react-force-graph
  const generateGraphData = useCallback(() => {
    const filteredNodes =
      complianceFilter === "all"
        ? nodes
        : nodes.filter((n) => n.type === complianceFilter);

    const newGraphNodes: GraphNode[] = filteredNodes.map((node) => {
      const sizeMap = { small: 8, medium: 12, large: 16 };
      const nodeSize = sizeMap[node.size];

      // Use blue for all nodes with varying intensity
      let color;
      if (node.type === "pass") {
        color = "rgba(59, 130, 246, 0.9)"; // Bright blue
      } else if (node.type === "warn") {
        color = "rgba(96, 165, 250, 0.8)"; // Light blue
      } else {
        color = "rgba(37, 99, 235, 0.85)"; // Deep blue
      }

      return {
        id: node.id,
        name: node.title,
        val: nodeSize,
        color: color,
        nodeData: node,
      };
    });

    // Generate links based on node connections
    const newGraphLinks: GraphLink[] = [];
    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    filteredNodes.forEach((node) => {
      node.connections.forEach((connectedNodeId) => {
        if (nodeIds.has(connectedNodeId)) {
          const linkExists = newGraphLinks.some(
            (link) =>
              (link.source === node.id && link.target === connectedNodeId) ||
              (link.source === connectedNodeId && link.target === node.id),
          );

          if (!linkExists) {
            newGraphLinks.push({
              source: node.id,
              target: connectedNodeId,
              color: "rgba(59, 130, 246, 0.15)",
              width: 1.5,
            });
          }
        }
      });
    });

    setGraphData({ nodes: newGraphNodes, links: newGraphLinks });
  }, [nodes, complianceFilter]);

  useEffect(() => {
    generateGraphData();
  }, [generateGraphData]);

  // Handle node click in graph
  const handleNodeClick = useCallback(
    (node: any) => {
      setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
    },
    [selectedNodeId],
  );

  // Handle node hover
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node);
  }, []);

  const profileRef = useRef<HTMLDivElement>(null);

  const filteredNodes =
    complianceFilter === "all"
      ? nodes
      : nodes.filter((n) => n.type === complianceFilter);

  const stats = {
    total: nodes.length,
    pass: nodes.filter((n) => n.type === "pass").length,
    warn: nodes.filter((n) => n.type === "warn").length,
    fail: nodes.filter((n) => n.type === "fail").length,
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f]">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-br from-blue-950/20 via-transparent to-purple-950/20" />
        <div className="animated-gradient absolute inset-0" />
      </div>

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 right-0 left-0 z-50 border-b border-blue-500/20 bg-[#0a0a0f]/95 backdrop-blur-xl">
        <div className="flex h-20 items-center justify-between px-6">
          {/* Logo - Clickable to go home (fixed position) */}
          <div className="w-[120px]">
            <Link href="/" className="cursor-pointer">
              <Image
                src="/full-logo.png"
                alt="Harmoniq Logo"
                width={120}
                height={40}
                className="h-10 w-[120px] object-contain"
                quality={100}
                unoptimized
              />
            </Link>
          </div>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Profile (fixed position) */}
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
      <div className="flex h-screen pt-20">
        {/* Left Half - PDF Viewer */}
        <div className="w-1/2 border-r border-blue-500/10 p-4">
          <div className="h-full overflow-hidden rounded-2xl border border-blue-500/10">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="h-full w-full border-0"
                title="PDF Viewer"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#0a0f1e]/50 p-6">
                <div className="text-center">
                  <svg
                    className="mx-auto mb-4 h-16 w-16 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-sm text-gray-400">No PDF uploaded yet</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Upload a document from the home page
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Half - Graph with Compliance Filters */}
        <div className="relative flex w-1/2 flex-col">
          {/* Error Cards Strip - Horizontal Scrollable */}
          <div className="border-b border-blue-500/10 p-3">
            <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
              {filteredNodes
                .filter((n) => n.type === "warn" || n.type === "fail")
                .map((node) => (
                  <div
                    key={node.id}
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      // Scroll to the node in the graph
                      const targetNode = graphData.nodes.find(
                        (n: any) => n.id === node.id,
                      );
                      if (targetNode && graphRef.current) {
                        graphRef.current.cameraPosition(
                          {
                            x: targetNode.x ?? 0,
                            y: targetNode.y ?? 0,
                            z: (targetNode.z ?? 0) + 200,
                          },
                          targetNode,
                          1000,
                        );
                      }
                    }}
                    className="glass-morphic group hover:blue-glow shrink-0 cursor-pointer rounded-xl border border-blue-500/15 p-3 transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-600/10"
                    style={{ minWidth: "240px" }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                          node.type === "warn"
                            ? "bg-yellow-600/20 text-yellow-400"
                            : "bg-red-600/20 text-red-400"
                        }`}
                      >
                        {node.type === "warn" ? "⚠" : "✕"}
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        {node.title}
                      </h4>
                    </div>
                    <p className="mb-2 text-xs text-gray-400">
                      {node.citation}
                    </p>
                    <p className="text-xs text-gray-500">{node.location}</p>
                  </div>
                ))}

              {filteredNodes.filter(
                (n) => n.type === "warn" || n.type === "fail",
              ).length === 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  No critical issues found
                </div>
              )}
            </div>
          </div>

          {/* Node Detail Modal - Bottom Right */}
          {selectedNodeId && (
            <div className="glass-morphic animate-in slide-in-from-right-4 absolute right-4 bottom-4 z-10 w-72 rounded-2xl border border-blue-500/20 duration-300">
              {(() => {
                const selectedNode = nodes.find((n) => n.id === selectedNodeId);
                return selectedNode ? (
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-2 text-lg font-bold text-white">
                          {selectedNode.title}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            selectedNode.type === "pass"
                              ? "bg-green-600/20 text-green-400"
                              : selectedNode.type === "warn"
                                ? "bg-yellow-600/20 text-yellow-400"
                                : "bg-red-600/20 text-red-400"
                          }`}
                        >
                          {selectedNode.type === "pass"
                            ? "✓"
                            : selectedNode.type === "warn"
                              ? "⚠"
                              : "✕"}
                          {selectedNode.type.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedNodeId(null)}
                        className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-all hover:bg-blue-600/10 hover:text-white"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>

                    <div className="mb-4 rounded-xl border border-blue-500/15 bg-blue-600/5 p-3">
                      <p className="mb-1 text-xs font-medium text-gray-400">
                        Requirement
                      </p>
                      <p className="text-sm leading-relaxed text-gray-200">
                        {selectedNode.requirement}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                        <p className="mb-1 text-xs font-medium text-gray-400">
                          Citation
                        </p>
                        <p className="font-mono text-sm text-blue-300">
                          {selectedNode.citation}
                        </p>
                      </div>

                      <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                        <p className="mb-1 text-xs font-medium text-gray-400">
                          Document Location
                        </p>
                        <p className="text-sm text-white">
                          {selectedNode.location}
                        </p>
                      </div>

                      <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                        <p className="mb-2 text-xs font-medium text-gray-400">
                          AI Confidence
                        </p>
                        <div className="mb-1 flex items-center justify-between">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-blue-600 to-blue-400"
                              style={{ width: `${selectedNode.confidence}%` }}
                            ></div>
                          </div>
                          <span className="ml-2 text-sm font-bold text-white">
                            {selectedNode.confidence}%
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                        <p className="mb-1 text-xs font-medium text-gray-400">
                          Related Requirements
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-blue-400">
                            {selectedNode.connections.length}
                          </span>
                          <span className="text-xs text-gray-500">
                            connections
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {/* 3D Force Graph */}
          <div
            ref={graphContainerRef}
            className="relative flex-1 overflow-hidden bg-[#0a0a0f]/50"
          >
            <ForceGraph3D
              ref={graphRef}
              graphData={graphData}
              width={graphDimensions.width}
              height={graphDimensions.height}
              nodeLabel={(node: any) => node.name}
              nodeVal={(node: any) => node.val}
              nodeColor={(node: any) => node.color}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              linkColor={(link: any) => link.color}
              linkWidth={(link: any) => link.width}
              linkDirectionalParticles={0}
              backgroundColor="rgba(10, 10, 15, 0)"
              showNavInfo={false}
              nodeThreeObject={(node: any) => {
                const nodeType = node.nodeData?.type;
                const isHovered = hoveredNode?.id === node.id;
                const isSelected = selectedNodeId === node.id;

                // Create sphere geometry
                const geometry = new THREE.SphereGeometry(node.val, 32, 32);

                // Create material with blue glow
                const material = new THREE.MeshPhongMaterial({
                  color: 0x3b82f6, // Always blue
                  transparent: true,
                  opacity: isHovered || isSelected ? 1 : 0.8,
                  emissive: 0x3b82f6, // Blue emissive
                  emissiveIntensity: isHovered || isSelected ? 0.6 : 0.3,
                  shininess: 150,
                });

                const sphere = new THREE.Mesh(geometry, material);

                // Add outer glow effect
                const glowGeometry = new THREE.SphereGeometry(
                  node.val * 1.4,
                  32,
                  32,
                );
                const glowMaterial = new THREE.MeshBasicMaterial({
                  color: 0x3b82f6,
                  transparent: true,
                  opacity: isHovered || isSelected ? 0.2 : 0.1,
                  side: THREE.BackSide,
                });
                const glow = new THREE.Mesh(glowGeometry, glowMaterial);
                sphere.add(glow);

                return sphere;
              }}
              nodeThreeObjectExtend={true}
              enableNodeDrag={true}
              d3AlphaDecay={0.01}
              d3VelocityDecay={0.3}
              warmupTicks={100}
              cooldownTicks={200}
              numDimensions={3}
              dagMode={undefined}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
