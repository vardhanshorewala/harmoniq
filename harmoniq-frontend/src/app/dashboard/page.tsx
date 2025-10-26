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
  type: string;
  text: string;
  section: string;
  clause_number: string;
  requirement_type: string;
  severity: string;
}

interface EdgeData {
  source: string;
  target: string;
  relation: string;
  confidence: number;
  source_type: string;
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [edges, setEdges] = useState<EdgeData[]>([]);
  const [isLoadingGraph, setIsLoadingGraph] = useState(true);
  const [isDetailsPanelExpanded, setIsDetailsPanelExpanded] = useState(false);

  // Load PDF from sessionStorage
  useEffect(() => {
    const storedUrl = sessionStorage.getItem("uploadedFileUrl");
    const storedName = sessionStorage.getItem("uploadedFileName");
    if (storedUrl) setPdfUrl(storedUrl);
    if (storedName) setFileName(storedName);
  }, []);

  // Fetch graph data from backend
  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        setIsLoadingGraph(true);
        const response = await fetch("http://localhost:8000/api/regulations/graph/data");
        
        if (!response.ok) {
          throw new Error("Failed to fetch graph data");
        }
        
        const data = await response.json();
        
        // Cap at 250 nodes for performance
        const cappedNodes = data.nodes.slice(0, 250);
        const nodeIds = new Set(cappedNodes.map((n: NodeData) => n.id));
        
        // Filter edges to only include edges between the capped nodes
        const cappedEdges = data.edges.filter(
          (e: EdgeData) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );
        
        setNodes(cappedNodes);
        setEdges(cappedEdges);
      } catch (error) {
        console.error("Error fetching graph data:", error);
        // Keep empty arrays on error
        setNodes([]);
        setEdges([]);
      } finally {
        setIsLoadingGraph(false);
      }
    };

    fetchGraphData();
  }, []);
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
      !graphRef.current ||
      graphData.nodes.length === 0 ||
      graphDimensions.width === 0
    ) {
      return;
    }

    // Wait for next tick to ensure graph is mounted
    const timer = setTimeout(() => {
      if (!graphRef.current) return;

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
    });

    return () => clearTimeout(timer);
  }, [graphData, graphDimensions]);

  // Generate graph data for react-force-graph
  const generateGraphData = useCallback(() => {
    if (nodes.length === 0) {
      setGraphData({ nodes: [], links: [] });
      return;
    }

    const newGraphNodes: GraphNode[] = nodes.map((node) => {
      // Determine node size based on severity
      const sizeMap: Record<string, number> = {
        high: 16,
        critical: 18,
        medium: 12,
        low: 8,
      };
      const nodeSize = sizeMap[node.severity] || 10;

      // Color nodes based on type (all blue variants)
      let color = "rgba(59, 130, 246, 0.9)"; // Default blue
      if (node.type === "clause") {
        color = "rgba(59, 130, 246, 0.9)"; // Bright blue
      }

      return {
        id: node.id,
        name: node.section || node.clause_number || node.id,
        val: nodeSize,
        color: color,
        nodeData: node,
      };
    });

    // Generate links from edges
    const newGraphLinks: GraphLink[] = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
              color: "rgba(59, 130, 246, 0.15)",
              width: 1.5,
    }));

    setGraphData({ nodes: newGraphNodes, links: newGraphLinks });
  }, [nodes, edges]);

  useEffect(() => {
    generateGraphData();
  }, [generateGraphData]);

  // Handle node click in graph
  const handleNodeClick = useCallback(
    (node: any) => {
      if (!node || !node.id) return;
      try {
      setSelectedNodeId(selectedNodeId === node.id ? null : node.id);
      } catch (error) {
        console.error("Error handling node click:", error);
      }
    },
    [selectedNodeId],
  );

  // Handle node hover
  const handleNodeHover = useCallback((node: any) => {
    if (!node) return;
    try {
    setHoveredNode(node);
    } catch (error) {
      console.error("Error handling node hover:", error);
    }
  }, []);

  const profileRef = useRef<HTMLDivElement>(null);

  const stats = {
    total: nodes.length,
    highSeverity: nodes.filter((n) => n.severity === "high").length,
    mediumSeverity: nodes.filter((n) => n.severity === "medium").length,
    lowSeverity: nodes.filter((n) => n.severity === "low").length,
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

        {/* Right Half - Graph with Details Panel */}
        <div className="relative flex w-1/2 flex-col">
          {/* Details Panel - Expandable */}
          <div
            className={`absolute left-0 right-0 top-0 z-20 ${
              isDetailsPanelExpanded
                ? "h-full"
                : "h-auto"
            } border-b border-blue-500/10 bg-[#0a0a0f]/95 backdrop-blur-xl overflow-hidden`}
            style={{
              transition: "height 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              background: isDetailsPanelExpanded 
                ? "linear-gradient(135deg, rgba(10, 10, 15, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)"
                : "rgba(10, 10, 15, 0.95)",
            }}
          >
            <div className="h-full flex flex-col">
              {/* Header with Toggle */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-sm font-semibold text-white transition-all duration-300">
                      {isDetailsPanelExpanded ? "Regulation Details" : "Key Regulations"}
                    </h3>
                    <p className="text-xs text-gray-400 transition-all duration-300">
                      {stats.total} nodes • {stats.highSeverity} high severity
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsDetailsPanelExpanded(!isDetailsPanelExpanded)}
                  className="group flex items-center gap-2 rounded-xl bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition-all duration-300 hover:bg-blue-500/20 hover:text-blue-300 hover:scale-105"
                >
                  <span className="transition-all duration-200">{isDetailsPanelExpanded ? "Collapse" : "Expand"}</span>
                  <svg
                    className={`h-4 w-4 transition-transform duration-[450ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
                      isDetailsPanelExpanded ? "rotate-180" : "rotate-0"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div
                className={`flex-1 ${
                  isDetailsPanelExpanded
                    ? "overflow-y-auto p-4 pt-0"
                    : "overflow-x-auto px-4 pb-4"
                } scrollbar-hide`}
                style={{
                  transition: "opacity 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94), padding 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                }}
              >
                <div 
                  className={`${isDetailsPanelExpanded ? "grid gap-4 grid-cols-1 md:grid-cols-2" : "flex gap-3"}`}
                >
              {isLoadingGraph ? (
                <div className="text-sm text-gray-400">Loading graph data...</div>
              ) : nodes.filter((n) => n.severity === "high" || n.severity === "critical").length > 0 ? (
                nodes
                  .filter((n) => n.severity === "high" || n.severity === "critical")
                  .slice(0, isDetailsPanelExpanded ? undefined : 10)
                  .map((node) => (
                    <div
                      key={node.id}
                      onClick={() => {
                        setSelectedNodeId(node.id);
                        if (!isDetailsPanelExpanded) {
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
                        }
                      }}
                      className={`glass-morphic group hover:blue-glow cursor-pointer rounded-2xl border border-blue-500/15 p-4 transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-600/10 hover:shadow-lg hover:shadow-blue-500/20 ${
                        isDetailsPanelExpanded ? "" : "shrink-0"
                      }`}
                      style={!isDetailsPanelExpanded ? { minWidth: "240px" } : {}}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold ${
                              node.severity === "critical"
                                ? "bg-gradient-to-br from-red-500/20 to-red-600/30 text-red-400"
                                : "bg-gradient-to-br from-yellow-500/20 to-yellow-600/30 text-yellow-400"
                            }`}
                          >
                            {node.severity === "critical" ? "✕" : "⚠"}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-white">
                              {node.section || node.clause_number}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {node.requirement_type || "N/A"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                            node.severity === "critical"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {node.severity}
                        </span>
                      </div>
                      <p
                        className={`text-xs leading-relaxed text-gray-400 ${
                          isDetailsPanelExpanded ? "line-clamp-3" : ""
                        }`}
                      >
                        {isDetailsPanelExpanded
                          ? node.text.substring(0, 200) + (node.text.length > 200 ? "..." : "")
                          : node.text.substring(0, 60) + "..."}
                      </p>
                      {isDetailsPanelExpanded && (
                        <div className="mt-3 flex items-center justify-between border-t border-blue-500/10 pt-3">
                          <div className="text-xs text-gray-500">
                            Node ID: <span className="font-mono text-blue-400">{node.id.split('-').pop()}</span>
                          </div>
                          <button className="text-xs font-medium text-blue-400 hover:text-blue-300">
                            View Details →
                          </button>
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Graph loaded: {stats.total} nodes
                </div>
              )}
                </div>
              </div>
            </div>
          </div>

          {/* Node Detail Modal - Bottom Right */}
          {selectedNodeId && !isDetailsPanelExpanded && (
            <div className="glass-morphic animate-in slide-in-from-right-4 absolute right-4 bottom-4 z-30 w-80 rounded-2xl border border-blue-500/20 duration-300 max-h-[80vh] overflow-y-auto">
              {(() => {
                const selectedNode = nodes.find((n) => n.id === selectedNodeId);
                const nodeEdges = edges.filter(
                  (e) => e.source === selectedNodeId || e.target === selectedNodeId
                );
                
                return selectedNode ? (
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="mb-2 text-lg font-bold text-white">
                          {selectedNode.section || selectedNode.clause_number || "Regulation Node"}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            selectedNode.severity === "critical"
                              ? "bg-red-600/20 text-red-400"
                              : selectedNode.severity === "high"
                                ? "bg-yellow-600/20 text-yellow-400"
                                : selectedNode.severity === "medium"
                                  ? "bg-blue-600/20 text-blue-400"
                                  : "bg-gray-600/20 text-gray-400"
                          }`}
                        >
                          {selectedNode.severity?.toUpperCase() || "N/A"}
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
                        Regulation Text
                      </p>
                      <p className="text-sm leading-relaxed text-gray-200">
                        {selectedNode.text || "No text available"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                        <p className="mb-1 text-xs font-medium text-gray-400">
                          Node ID
                        </p>
                        <p className="font-mono text-xs text-blue-300 break-all">
                          {selectedNode.id}
                        </p>
                      </div>

                      <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                        <p className="mb-1 text-xs font-medium text-gray-400">
                          Type
                        </p>
                        <p className="text-sm text-white">
                          {selectedNode.type || "N/A"}
                        </p>
                      </div>

                      {selectedNode.clause_number && (
                      <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                          <p className="mb-1 text-xs font-medium text-gray-400">
                            Clause Number
                          </p>
                          <p className="text-sm text-white">
                            {selectedNode.clause_number}
                          </p>
                          </div>
                      )}

                      {selectedNode.requirement_type && (
                        <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                          <p className="mb-1 text-xs font-medium text-gray-400">
                            Requirement Type
                          </p>
                          <p className="text-sm text-white">
                            {selectedNode.requirement_type}
                          </p>
                        </div>
                      )}

                      <div className="rounded-lg border border-blue-500/10 bg-[#0a0f1e]/50 p-3">
                        <p className="mb-1 text-xs font-medium text-gray-400">
                          Connections
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-blue-400">
                            {nodeEdges.length}
                          </span>
                          <span className="text-xs text-gray-500">
                            edges in graph
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
            {/* Dimming overlay when panel is expanded */}
            <div 
              className={`absolute inset-0 z-10 bg-[#0a0a0f] ${
                isDetailsPanelExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{
                transition: "opacity 450ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              }}
            />
            {isLoadingGraph ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500"></div>
                  <p className="text-sm text-gray-400">Loading graph data...</p>
                </div>
              </div>
            ) : graphData.nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center">
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
                      d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                    />
                  </svg>
                  <p className="text-sm text-gray-400">No graph data available</p>
                  <p className="mt-2 text-xs text-gray-500">
                    Upload regulations to generate the knowledge graph
                  </p>
                </div>
              </div>
            ) : (
            <ForceGraph3D
              key={`graph-${graphData.nodes.length}`}
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
                try {
                  if (!node || !node.val) {
                    // Return a simple default sphere if node data is invalid
                    const defaultGeometry = new THREE.SphereGeometry(5, 16, 16);
                    const defaultMaterial = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
                    return new THREE.Mesh(defaultGeometry, defaultMaterial);
                  }

                const isHovered = hoveredNode?.id === node.id;
                const isSelected = selectedNodeId === node.id;

                  // Create sphere geometry with safe values
                  const nodeSize = Math.max(5, Math.min(node.val || 10, 50)); // Clamp between 5 and 50
                  const geometry = new THREE.SphereGeometry(nodeSize, 32, 32);

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
                  
                  // Ensure sphere has proper matrix
                  sphere.matrixAutoUpdate = true;
                  sphere.updateMatrix();

                // Add outer glow effect
                const glowGeometry = new THREE.SphereGeometry(
                    nodeSize * 1.4,
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
                  glow.matrixAutoUpdate = true;
                  glow.updateMatrix();
                  
                sphere.add(glow);

                return sphere;
                } catch (error) {
                  console.error("Error creating node object:", error);
                  // Return a minimal fallback sphere
                  const fallbackGeometry = new THREE.SphereGeometry(5, 16, 16);
                  const fallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
                  const fallbackSphere = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
                  fallbackSphere.matrixAutoUpdate = true;
                  return fallbackSphere;
                }
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
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
