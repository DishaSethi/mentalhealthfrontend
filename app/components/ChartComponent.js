"use client"; // Ensure this runs only on the client side

import React, { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import Chart from "chart.js/auto";

const ChartComponent = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchAnalysisHistory = async () => {
      try {
        const response = await fetch("https://mentalhealthplatform.onrender.com/api/chatbot/analysisHistory", {
          method: "GET",
          credentials: "include", // Important for session persistence
        });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Fetched Data:", data); // Debugging step
        const history = data.history || [];

        if (history.length === 0) {
          return;
        }

        // Extract timestamps, scores, and sentiment values
        const labels = history.map((entry) => new Date(entry.timestamp).toLocaleString());
        const scores = history.map((entry) => entry.score);
        const sentiments = history.map((entry) => 
          entry.sentiment === "positive" ? 1 : entry.sentiment === "negative" ? -1 : 0
        );

        // Set Chart Data
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

    fetchAnalysisHistory();
  }, []);

  return (
    <div>
      <h2>Mental Health Progress</h2>
      {chartData ? <Line data={chartData} /> : <p>Loading chart...</p>}
    </div>
  );
};

export default ChartComponent;
