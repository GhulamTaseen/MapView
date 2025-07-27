import { use, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { Rnd } from "react-rnd";
import {
  Card,
  CardContent,
  Typography,
  CardActions,
  IconButton,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Menu,
  MenuItem,
  CardMedia,
  TableFooter,
  Link,
  Tooltip,
} from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { useTheme } from "@mui/material";
import { map } from "../../map/core/MapView";
import CloseIcon from "@mui/icons-material/Close";
import ReplayIcon from "@mui/icons-material/Replay";
import PublishIcon from "@mui/icons-material/Publish";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PendingIcon from "@mui/icons-material/Pending";

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocationPinIcon from "@mui/icons-material/LocationPin";
import SpeedIcon from "@mui/icons-material/Speed";
import RouteIcon from "@mui/icons-material/Route";
import AdjustIcon from "@mui/icons-material/Adjust";
import InfoIcon from "@mui/icons-material/Info";
import LocalParkingIcon from "@mui/icons-material/LocalParking";
import DirectionsIcon from "@mui/icons-material/Directions";

import { useTranslation } from "./LocalizationProvider";
import RemoveDialog from "./RemoveDialog";
import PositionValue from "./PositionValue";
import { useDeviceReadonly } from "../util/permissions";
import usePositionAttributes from "../attributes/usePositionAttributes";
import { devicesActions } from "../../store";
import { useCatch, useCatchCallback } from "../../reactHelper";
import { useAttributePreference } from "../util/preferences";

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  card: {
    pointerEvents: "auto",
    // width: theme.dimensions.popupMaxWidth,
    //  width: theme.spacing(50),
  },
  media: {
    height: theme.dimensions.popupImageHeight,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "flex-start",
  },
  mediaButton: {
    color: theme.palette.primary.contrastText,
    mixBlendMode: "difference",
  },
  iconWrapper: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    color: theme.palette.primary.main,
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0.5, 1, 0.5, 0),
    position: "relative",
    "&::after": {
      content: '""',
      position: "absolute",
      bottom: 0,
      left: theme.spacing(1),
      right: theme.spacing(1),
      height: theme.spacing(0.1),
      backgroundColor: theme.palette.grey[400],
    },
  },
  content: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    maxHeight: theme.dimensions.cardContentMaxHeight,
    overflow: "auto",
  },
  icon: {
    width: "25px",
    height: "25px",
    filter: "brightness(0) invert(1)",
  },
  keyIcon: {
    color: theme.palette.error.main,
  },
  headerTitle: {
    color: theme.palette.primary.main,
    fontWeight: 600,
    fontSize: theme.typography.pxToRem(15),
  },

  table: {
    "& .MuiTableCell-sizeSmall": {
      paddingLeft: 0,
      paddingRight: 0,
    },
    "& .MuiTableCell-sizeSmall:first-of-type": {
      paddingRight: theme.spacing(1),
    },
  },
  cell: {
    display: "flex",
    alignItems: "center",
    borderBottom: "none",
    margin: 0,
    gap: 0,
  },
  actions: {
    justifyContent: "space-between",
  },
  root: {
    pointerEvents: "none",
    position: "fixed",
    // zIndex: 5,
    left: "50%",
    [theme.breakpoints.up("md")]: {
      left: `calc(50% + ${desktopPadding} / 2)`,
      bottom: theme.spacing(3),
    },
    [theme.breakpoints.down("md")]: {
      left: "50%",
      bottom: `calc(${theme.spacing(3)} + ${
        theme.dimensions.bottomBarHeight
      }px)`,
    },
    transform: "translateX(-50%)",
  },
  statusIcon: {
    fontSize: "20px",
     verticalAlign: 'middle',
    color: theme.palette.primary.main,
  },
}));


const StatusRow = ({ icon, content }) => {
  const { classes } = useStyles({ desktopPadding: 10 });
  return (
    <TableRow>
      <TableCell colSpan={2} style={{ borderBottom: "none" }}>
        <div className={classes.iconWrapper}>
          {icon}
          <Typography variant="body2" color="textSecondary">
            {content}
          </Typography>
        </div>
      </TableCell>
    </TableRow>
  );
};

const StatusCard = ({
  deviceId,
  position,
  onClose,
  disableActions,
  desktopPadding = 0,
}) => {
  const { classes } = useStyles({ desktopPadding });
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const deviceReadonly = useDeviceReadonly();

  const shareDisabled = useSelector(
    (state) => state.session.server.attributes.disableShare
  );
  const user = useSelector((state) => state.session.user);
  const device = useSelector((state) => state.devices.items[deviceId]);

  const deviceImage = device?.attributes?.deviceImage;

  const positionAttributes = usePositionAttributes(t);
  const positionItems = useAttributePreference(
    "positionItems", "fixTime,address,speed,totalDistance"
  );
  const keyIconMap = {
    fixTime: (
      <AccessTimeIcon
        fontSize="small"
        sx={{ verticalAlign: "middle" }}
        className={classes.keyIcon}
      />
    ),
    address: (
      <LocationPinIcon
        fontSize="small"
        sx={{ verticalAlign: "middle" }}
        className={classes.keyIcon}
      />
    ),
    speed: (
      <SpeedIcon
        fontSize="small"
        sx={{ verticalAlign: "middle" }}
        className={classes.keyIcon}
      />
    ),
    totalDistance: (
      <RouteIcon
        fontSize="small"
        sx={{ verticalAlign: "middle" }}
        className={classes.keyIcon}
      />
    ),
  };

  const navigationAppLink = useAttributePreference("navigationAppLink");
  const navigationAppTitle = useAttributePreference("navigationAppTitle");

  const [anchorEl, setAnchorEl] = useState(null);

  const [removing, setRemoving] = useState(false);

  const handleRemove = useCatch(async (removed) => {
    if (removed) {
      const response = await fetch("/api/devices");
      if (response.ok) {
        dispatch(devicesActions.refresh(await response.json()));
      } else {
        throw Error(await response.text());
      }
    }
    setRemoving(false);
  });

  const handleGeofence = useCatchCallback(async () => {
    const newItem = {
      name: t("sharedGeofence"),
      area: `CIRCLE (${position.latitude} ${position.longitude}, 50)`,
    };
    const response = await fetch("/api/geofences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    if (response.ok) {
      const item = await response.json();
      const permissionResponse = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: position.deviceId,
          geofenceId: item.id,
        }),
      });
      if (!permissionResponse.ok) {
        throw Error(await permissionResponse.text());
      }
      navigate(`/settings/geofence/${item.id}`);
    } else {
      throw Error(await response.text());
    }
  }, [navigate, position]);
  

  return (
    <>
      <div className={classes.root}>
        {device && (
          <Rnd
            default={{ x: 0, y: 0, width: "auto", height: "auto" }}
            enableResizing={false}
            dragHandleClassName="draggable-header"
            style={{ position: "relative" }}
          >
            <Card elevation={3} className={classes.card}>
              {deviceImage ? (
                <CardMedia
                  className={`${classes.media} draggable-header`}
                  image={`/api/media/${device.uniqueId}/${deviceImage}`}
                >
                  <IconButton
                    size="small"
                    onClick={onClose}
                    onTouchStart={onClose}
                  >
                    <CloseIcon
                      fontSize="small"
                      className={classes.mediaButton}
                    />
                  </IconButton>
                </CardMedia>
              ) : (
                <div
                  className={`${classes.header} draggable-header`}
                  style={{}}
                >
                  <IconButton size="small" >
                    <AdjustIcon fontSize="small" color="error" />
                  </IconButton>
                  <Typography className={classes.headerTitle}>
                    {device.name}
                  </Typography>
                  <div
                    style={{
                      marginLeft: "auto",
                      marginRight: 0,
                      paddingRight: 0,
                    }}
                  >
                    <IconButton size="small">
                      <InfoIcon className={classes.statusIcon} />
                    </IconButton>
                    {position && (
                      <IconButton
                        size="small"
                        component="a"
                        href={`https://www.google.com/maps/search/?api=1&query=${position.latitude},${position.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <DirectionsIcon className={classes.statusIcon} />
                      </IconButton>
                    )}

                    <IconButton size="small">
                      <LocalParkingIcon className={classes.statusIcon} />
                    </IconButton>
                  </div>
                </div>
              )}

              {position && (
                <CardContent className={classes.content}>
                  <Table size="small" classes={{ root: classes.table }}>
                    <TableBody>
                      {positionItems
                        .split(",")
                        .filter(
                          (key) =>
                            position.hasOwnProperty(key) ||
                            position.attributes.hasOwnProperty(key)
                        )
                        .map((key) => (
                          <StatusRow
                            key={key}
                            icon={keyIconMap[key]}
                            content={
                              <PositionValue
                                position={position}
                                property={
                                  position.hasOwnProperty(key) ? key : null
                                }
                                attribute={
                                  position.hasOwnProperty(key) ? null : key
                                }
                              />
                            }
                          />
                        ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className={classes.cell}>
                          <Typography variant="body2">
                            <Link
                              component={RouterLink}
                              to={`/position/${position.id}`}
                            >
                              {t("sharedShowDetails")}
                            </Link>
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              )}
              <CardActions classes={{ root: classes.actions }} disableSpacing>
                <Tooltip title={t("sharedExtra")}>
                  <IconButton
                    color="secondary"
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                    disabled={!position}
                  >
                    <PendingIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("sharedRemoveCard")} placement="top">
                  <IconButton
                    // size="small"
                    onClick={onClose}
                    onTouchStart={onClose}
                  >
                    <CloseIcon color="error" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("reportReplay")}>
                  <IconButton
                    onClick={() => navigate("/replay")}
                    disabled={disableActions || !position}
                  >
                    <ReplayIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("commandTitle")}>
                  <IconButton
                    onClick={() =>
                      navigate(`/settings/device/${deviceId}/command`)
                    }
                    disabled={disableActions}
                  >
                    <PublishIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("sharedEdit")}>
                  <IconButton
                    onClick={() => navigate(`/settings/device/${deviceId}`)}
                    disabled={disableActions || deviceReadonly}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("sharedRemove")}>
                  <IconButton
                    color="error"
                    onClick={() => setRemoving(true)}
                    disabled={disableActions || deviceReadonly}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Rnd>
        )}
      </div>
      {position && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={handleGeofence}>
            {t("sharedCreateGeofence")}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}
          >
            {t("linkGoogleMaps")}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            href={`http://maps.apple.com/?ll=${position.latitude},${position.longitude}`}
          >
            {t("linkAppleMaps")}
          </MenuItem>
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`}
          >
            {t("linkStreetView")}
          </MenuItem>
          {navigationAppTitle && (
            <MenuItem
              component="a"
              target="_blank"
              href={navigationAppLink
                .replace("{latitude}", position.latitude)
                .replace("{longitude}", position.longitude)}
            >
              {navigationAppTitle}
            </MenuItem>
          )}
          {!shareDisabled && !user.temporary && (
            <MenuItem
              onClick={() => navigate(`/settings/device/${deviceId}/share`)}
            >
              <Typography color="secondary">{t("deviceShare")}</Typography>
            </MenuItem>
          )}
        </Menu>
      )}
      <RemoveDialog
        open={removing}
        endpoint="devices"
        itemId={deviceId}
        onResult={(removed) => handleRemove(removed)}
      />
    </>
  );
};

export default StatusCard;
