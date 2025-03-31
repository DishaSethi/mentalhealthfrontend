"use client";

import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import { Line } from "react-chartjs-2";
// import Chart from "chart.js/auto";
import { Chart, registerables } from 'chart.js';

// Register all the components
const API_BASE_URL = "https://mentalhealthplatform.onrender.com";
// const API_BASE_URL = "http://localhost:5000";

Chart.register(...registerables);

export default function Chatbot() {
    const [message, setMessage] = useState("");
    const [chatHistory, setChatHistory] = useState([]);
    const chatContainerRef = useRef(null);
    const [socket, setSocket] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [report, setReport] = useState(null);
    const [currentScore, setCurrentScore] = useState(null);
    const router = useRouter();
    const [chartData, setChartData] = useState(null);
    const [showChart, setShowChart] = useState(false);

    useEffect(() => {
        setChatHistory([]);  // Clear chat history
        setSessionId(null);  // Reset session ID
        setReport(null);     // Reset report data
    
        // Optional: Clear sessionStorage
        sessionStorage.clear();
    
    }, []);
    

    const clearSession = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/clearSession`, {
                method: "POST",
                credentials: "include", // Send session cookie
            });
    
            if (!res.ok) {
                throw new Error(`Error: ${res.statusText}`);
            }
    
            const data = await res.json();
            console.log(data.message);
    
            // Reset session-dependent states
            setSessionId(null);
            setChatHistory([]);
            setReport(null);
            setCurrentScore(null);
            setChartData(null);
            setShowChart(false);
    
            alert("Session cleared successfully!"); // Notify user
        } catch (error) {
            console.error("Error clearing session:", error);
            alert("Failed to clear session.");
        }
    };
    
    const fetchAnalysisHistory = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/analysisHistory`, {
            method: "GET",
            credentials: "include",
          });
          const data = await response.json();
    
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
    
          console.log("Fetched Data:", data); // Debugging
          const history = data.history || [];
    
          if (history.length === 0) {
            setChartData(null);
            setCurrentScore(null);
            return;
          }
    
          const labels = history.map(entry => 
            new Date(entry.timestamp).toLocaleString()
          );
          const scores = history.map(entry => entry.score);
          const sentiments = history.map(entry => 
            entry.sentiment === "POSITIVE" ? 1 : entry.sentiment === "NEGATIVE" ? -1 : 0
          );

          setCurrentScore(scores[scores.length - 1]);
          setChartData({
            labels,
            datasets: [
              {
                label: "Mental Health Score",
                data: scores,
                borderColor: "blue",
                fill: false,
                tension: 0.1,
              },
              {
                label: "Sentiment (1=Positive, 0=Neutral, -1=Negative)",
                data: sentiments,
                borderColor: "red",
                fill: false,
                tension: 0.1,
              },
            ],
          });
        } catch (error) {
          console.error("Error fetching analysis history:", error);
        }
      };

      const handleShowChart = () => {
        fetchAnalysisHistory(); // Fetch the latest data
        setShowChart(true); // Show chart
      };
    
      const handleClearChart = () => {
        setChartData(null); // Clear the chart data
        setShowChart(false); // Hide chart
      };
    

    useEffect(() => {
        const newSocket = io(`${API_BASE_URL}`, { 
            withCredentials: true,
            transports: ["websocket", "polling"] 
        });

        newSocket.on("connect", () => {
            console.log("✅ Connected to server", newSocket.id);
            newSocket.emit("startSession");
        });

        newSocket.on("connect_error", (err) => {
            console.error("❌ Socket connection error:", err);
        });

        newSocket.on("disconnect", (reason) => {
            console.warn("⚠️ Disconnected from server:", reason);
        });

        newSocket.on("sessionId", (id) => {
            console.log("📌 Session ID received:", id);
            setSessionId(id);
        });

        newSocket.on("aiMessage", (response) => {
            console.log("🤖 AI Response:", response);
            console.log("Received AI Response:", response, typeof response);
            
            // Ensure response is a string
            const aiText = typeof response === "string" ? response : response.response;
            
            setChatHistory(prev => [...prev, { sender: "AI", text: aiText }]);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({ 
                top: chatContainerRef.current.scrollHeight, 
                behavior: "smooth" 
            });
        }
    }, [chatHistory]);

    const sendMessage = () => {
        if (!message.trim() || !socket) return;

        setChatHistory(prev => [...prev, { sender: "User", text: message }]);
        socket.emit("userMessage", message);
        setMessage(""); // Clear input
    };

    // Function to generate and download the report
    const generateReport = async () => {
        if (!sessionId) {
            console.error("Session ID missing");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/report/${sessionId}`, {
                method: "GET",
                credentials: "include", // Ensure cookies are sent
                headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
                throw new Error(`Error: ${res.statusText}`);
            }

            const data = await res.json();
            console.log("Report Generated:", data);

            setReport(data.report || "No report available.");

            // Create and download the text file
            const blob = new Blob([data.report], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `chat_report_${sessionId}.txt`; // File name with session ID
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generating report:", error);
            setReport("Error fetching report.");
        }
    };

    const clearReport = () => {
        setReport(null);
    };

    // Function to handle file upload
    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        const formData = new FormData();
        formData.append("file", file);
    
        try {
            const res = await fetch(`${API_BASE_URL}/api/uploadReport`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });
    
            if (!res.ok) {
                throw new Error(`Error: ${res.statusText}`);
            }
    
            const data = await res.json();
            console.log("Report uploaded successfully:", data);
    
            // Set the chat history with the report text and AI response
            setChatHistory(prev => [
                ...prev,
                { sender: "User", text: "Uploaded a report" },
                { sender: "System", text: "Processing report..." },
                { sender: "AI", text: data.aiResponse }, // AI-generated therapy response
            ]);
        } catch (error) {
            console.error("Error uploading report:", error);
            setChatHistory(prev => [
                ...prev, 
                { sender: "System", text: "Error uploading report." }
            ]);
        }
    };
    return (
        <div className="flex flex-col h-screen w-screen bg-gradient-to-br from-[#34e89e] to-[#0f3443] text-white p-6">
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 p-4">
                {chatHistory && chatHistory.map((msg, index) => (
                    <div key={index} className={`max-w-[75%] p-3 rounded-lg shadow-md ${msg.sender === "User" ? "bg-blue-500 ml-auto" : "bg-gray-700 mr-auto"}`}>
                        <strong>{msg.sender}</strong>: {msg.text}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:outline-none"
                />
                <button onClick={sendMessage} className="bg-blue-500 px-4 py-2 rounded-lg shadow-lg hover:bg-blue-600 transition-all">
                    Send
                </button>
                <button onClick={generateReport} className="bg-green-500 px-4 py-2 rounded-lg shadow-lg hover:bg-green-600 transition-all">
                    Download Report
                </button>
                <input 
                    type="file" 
                    accept=".txt" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    id="upload-report"
                />
                <label htmlFor="upload-report" className="bg-yellow-500 px-4 py-2 rounded-lg shadow-lg hover:bg-yellow-600 transition-all cursor-pointer">
                    Upload Report
                </label>
                <button onClick={handleShowChart} className="bg-purple-500 px-4 py-2 rounded-lg shadow-lg hover:bg-purple-600 transition-all">
                    View Progress Chart 📊
                </button>
                <button 
                    onClick={clearSession} 
                    className="bg-red-500 px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-all"
                >
                    Clear Session 
                </button>
            </div>
    
            {showChart && chartData && (
                <div className="w-full bg-gray-800 p-4 mt-4 rounded-lg shadow-lg">
                    <h2 className="text-lg font-bold mb-2">📊 Mental Health Progress Chart:
                    </h2>
                    <Line data={chartData} />
                    {currentScore !== null && (
                        <div className="bg-blue-500 text-white p-3 rounded-lg shadow-lg">
                            <h3 className="text-lg font-bold">Current Score: {currentScore}</h3>
                        </div>
                    )}
                    <button
                        onClick={handleClearChart}
                        className="mt-4 bg-red-500 px-4 py-2 rounded-lg shadow-lg hover:bg-red-600 transition-all"
                    >
                        Clear Chart
                    </button>
                </div>
            )}
    
            {report && (
                <div className="bg-gray-800 p-4 mt-4 rounded-lg shadow-lg">
                    <h2 className="text-lg font-bold mb-2">📝 Generated Report:
                    </h2>
                    <p className="whitespace-pre-wrap">{report}</p>
                    <button 
                        onClick={clearReport} 
                        className="absolute top-2 right-2 bg-red-500 px-2 py-1 text-xs rounded-full hover:bg-red-600 transition-all"
                    >
                        ❌ Clear
                    </button>
                </div>
            )}
        </div>
    );
}