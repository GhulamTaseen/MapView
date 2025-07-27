import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Snackbar,
  Alert,
  Divider,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import SettingsMenu from "./SettingsMenu";
import PageLayout from "../../common/components/PageLayout";

const XmlFileDisplay = () => {
  const [xmlContent, setXmlContent] = useState("");
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [showRestart, setShowRestart] = useState(false);

  useEffect(() => {
    axios
      .get("/api/xmlfile", {
        headers: { Accept: "application/xml" },
        responseType: "text",
      })
      .then((response) => {
        setXmlContent(response.data);
      })
      .catch((err) => {
        console.error(err);
        setError("❌ Error fetching XML file");
      });
  }, []);

  const handleSave = () => {
    axios
      .post("/api/xmlfile", xmlContent, {
        headers: { "Content-Type": "application/xml" },
      })
      .then(() => {
        setSaveStatus(
          "✅ File saved successfully! Please restart Traccar Server."
        );
        setShowRestart(true);
      })
      .catch((error) => {
        console.error(error);
        if (error.response?.status === 403) {
          setSaveStatus("❌ Admin access required to save.");
        } else {
          setSaveStatus("❌ Failed to save file.");
        }
        setShowRestart(false);
      });
  };

  const handleRestart = async () => {
    try {
      if (window.confirm("Are you sure you want to restart the server?")) {
        await axios.post("/api/server/reboot");
        alert("🔄 Server is restarting...");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <PageLayout
      menu={<SettingsMenu />}
      breadcrumbs={["settingsTitle", "xmlFileDisplay"]}
    >
      <Box sx={{ width: "70vw", mx: "auto", mt: 5 }}>
        <Card elevation={3}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              🛠️ XML Configuration Editor
            </Typography>
            <TextField
              multiline
              fullWidth
              minRows={15}
              maxRows={40}
              value={xmlContent}
              onChange={(e) => setXmlContent(e.target.value)}
              variant="outlined"
              sx={{ mt: 2, fontFamily: "monospace" }}
              placeholder="Edit XML here..."
            />

            <Box
              mt={3}
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                sx={{ textTransform: "none" }}
              >
                Save File
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RestartAltIcon />}
                onClick={handleRestart}
                sx={{ textTransform: "none" }}
              >
                Restart Server
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            {saveStatus && (
              <Alert
                severity={saveStatus.startsWith("✅") ? "success" : "error"}
                onClose={() => setSaveStatus("")}
              >
                {saveStatus}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Box>
    </PageLayout>
  );
};

export default XmlFileDisplay;
