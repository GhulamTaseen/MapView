import React, { useEffect, useState, useCallback, use } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Alert,
  Button,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import PageLayout from "../common/components/PageLayout";
import SettingsMenu from "./components/SettingsMenu";

const formatBytesToGB = (bytes) => {
  return (bytes / 1024 ** 3).toFixed(2);
};

const StorageInfo = () => {
  const [storage, setStorage] = useState(null);
  const [error, setError] = useState(null);
  const fetchStorage = useCallback(() => {
    axios
      .get("/api/server")
      .then((res) => {
        const { storageSpace } = res.data;
        // console.log(storageSpace);
        if (storageSpace.length === 4) {
          let arr = [];
          let half = storageSpace.length / 2;
          for (let i = 0; i < half; i++) {
            arr.push(storageSpace[i] + storageSpace[i + half]);
          }
          const ConvertToGB = 1073741824;
          const divi = arr.map((item) => item / ConvertToGB);
          console.log("UseAble and Total space is : ", divi);
          setStorage(storageSpace);
          setError(null);
        } else {
          setError("Storage data not available.");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch server info.");
      });
  }, []);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  const renderContent = () => {
    if (error) {
      return (
        <Card sx={{ maxWidth: 720, margin: "auto", mt: 3, p: 2 }}>
          <CardContent>
            <Typography color="error" variant="body1">
              {error}
            </Typography>
          </CardContent>
        </Card>
      );
    }

    if (!storage) {
      return (
        <Card sx={{ maxWidth: 400, margin: "auto", mt: 3, p: 2 }}>
          <CardContent>
            <Typography variant="body1">⏳ Loading storage info...</Typography>
          </CardContent>
        </Card>
      );
    }

    const [usedBytes, totalBytes] = storage;
    const usedGB = formatBytesToGB(usedBytes);
    const totalGB = formatBytesToGB(totalBytes);
    const percentage = ((usedBytes / totalBytes) * 100).toFixed(1);

    let storageDisk = null;
    if (Number(percentage) <= 10 && Number(percentage) >= 5) {
      storageDisk = (
        <Alert severity="warning" sx={{ mb: "8px" }}>
          Storage is 90% used!
        </Alert>
      );
    } else if (Number(percentage) <= 5 && Number(percentage) >= 0) {
      storageDisk = (
        <Alert severity="error" sx={{ mb: "8px" }}>
          Storage is 95% used !
        </Alert>
      );
    }
    return (
      <Card
        sx={{
          width: "40%",
          margin: "auto",
          mt: 4,
          boxShadow: 3,
          borderRadius: 3,
          backgroundColor: "#fefefe",
        }}
      >
        <CardContent>
          {storageDisk}
          <Box display="flex" alignItems="center" mb={2}>
            <StorageIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              Server Storage Usage
            </Typography>
            <Box ml="auto">
              <Button
                onClick={fetchStorage}
                style={{
                  padding: "6px 16px",
                  borderRadius: 4,
                  border: "none",
                  background: "#1976d2",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Refresh
              </Button>
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>{usedGB} GB</strong> free out of {" "}
            <strong>{totalGB} GB</strong>
          </Typography>

          <LinearProgress
            variant="determinate"
            value={Number(totalGB - usedGB) / totalGB * 100 }
            sx={{
              height: 16,
              borderRadius: 3,
              backgroundColor: "#ddd",
              "& .MuiLinearProgress-bar": {
                backgroundColor: percentage > 90 ? "#43a047" : "#43a047",
              },
            }}
          />

          <Typography variant="caption" display="block" align="right" mt={1}>
            {percentage}% Remaining
          </Typography>
        </CardContent>
      </Card>
    );
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={["settingsTitle", "Storage"]}
    >
      {renderContent()}
    </PageLayout>
  );
};

export default StorageInfo;
