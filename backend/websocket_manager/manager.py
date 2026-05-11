"""
WebSocket Connection Manager
Handles real-time EEG streaming, training progress broadcasting,
and live inference result distribution.
"""
import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections with channel-based routing."""

    def __init__(self):
        # Separate pools for different stream types
        self.eeg_connections: List[WebSocket] = []
        self.training_connections: List[WebSocket] = []
        self.inference_connections: List[WebSocket] = []

    async def connect_eeg(self, websocket: WebSocket):
        await websocket.accept()
        self.eeg_connections.append(websocket)
        logger.info(f"EEG stream connected. Total: {len(self.eeg_connections)}")

    async def connect_training(self, websocket: WebSocket):
        await websocket.accept()
        self.training_connections.append(websocket)
        logger.info(f"Training monitor connected. Total: {len(self.training_connections)}")

    async def connect_inference(self, websocket: WebSocket):
        await websocket.accept()
        self.inference_connections.append(websocket)
        logger.info(f"Inference stream connected. Total: {len(self.inference_connections)}")

    def disconnect_eeg(self, websocket: WebSocket):
        if websocket in self.eeg_connections:
            self.eeg_connections.remove(websocket)
        logger.info(f"EEG stream disconnected. Total: {len(self.eeg_connections)}")

    def disconnect_training(self, websocket: WebSocket):
        if websocket in self.training_connections:
            self.training_connections.remove(websocket)

    def disconnect_inference(self, websocket: WebSocket):
        if websocket in self.inference_connections:
            self.inference_connections.remove(websocket)

    async def broadcast_eeg(self, data: dict):
        """Broadcast EEG data to all connected EEG clients."""
        dead = []
        for ws in self.eeg_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_eeg(ws)

    async def broadcast_training(self, data: dict):
        """Broadcast training progress to all training monitors."""
        dead = []
        for ws in self.training_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_training(ws)

    async def broadcast_inference(self, data: dict):
        """Broadcast inference results to all inference clients."""
        dead = []
        for ws in self.inference_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_inference(ws)

    @property
    def total_connections(self) -> int:
        return (
            len(self.eeg_connections)
            + len(self.training_connections)
            + len(self.inference_connections)
        )

    def get_status(self) -> Dict:
        return {
            "eeg_clients": len(self.eeg_connections),
            "training_clients": len(self.training_connections),
            "inference_clients": len(self.inference_connections),
            "total": self.total_connections,
        }
