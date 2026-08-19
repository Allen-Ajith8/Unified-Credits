"""
Engine B — Model Module
========================
Heterogeneous Graph Attention Network using HGTConv
(Heterogeneous Graph Transformer Convolution).

Architecture:
    Layer 1: HGTConv  (in_features → 64, 4 heads)
    Layer 2: HGTConv  (64 → 32, 4 heads)
    Classifier head:  Linear(32 → 2) for training signal

Output: 32-dim trust embedding per customer node.
"""

import torch
import torch.nn.functional as F
from torch_geometric.nn import HGTConv, Linear


EMBEDDING_DIM = 32
HIDDEN_DIM = 64
NUM_HEADS = 4


class HeteroGAT(torch.nn.Module):
    """
    2-layer Heterogeneous Graph Transformer for credit risk embeddings.

    Uses HGTConv which learns type-specific attention across heterogeneous
    edge types (shared_device, shared_ip, shared_employer, etc.).
    """

    def __init__(self, metadata: tuple, in_channels: int,
                 hidden_channels: int = HIDDEN_DIM,
                 out_channels: int = EMBEDDING_DIM,
                 num_heads: int = NUM_HEADS):
        """
        Args:
            metadata: HeteroData.metadata() — (node_types, edge_types).
            in_channels: Number of input features per customer node.
            hidden_channels: Hidden layer dimension.
            out_channels: Final embedding dimension.
            num_heads: Attention heads per HGTConv layer.
        """
        super().__init__()

        self.lin_in = Linear(in_channels, hidden_channels)

        self.conv1 = HGTConv(
            in_channels=hidden_channels,
            out_channels=hidden_channels,
            metadata=metadata,
            heads=num_heads,
        )
        self.conv2 = HGTConv(
            in_channels=hidden_channels,
            out_channels=out_channels,
            metadata=metadata,
            heads=num_heads,
        )

        self.classifier = torch.nn.Linear(out_channels, 2)

    def forward(self, x_dict: dict[str, torch.Tensor],
                edge_index_dict: dict[tuple, torch.Tensor]) -> dict[str, torch.Tensor]:
        """
        Forward pass — returns embedding dict keyed by node type.

        Args:
            x_dict: {'customer': Tensor[N, in_channels]}
            edge_index_dict: {('customer', rel, 'customer'): Tensor[2, E]} for each relation.

        Returns:
            Dict with key 'customer' → Tensor[N, out_channels]
        """
        # Project input features to hidden dim
        x_dict = {key: self.lin_in(x) for key, x in x_dict.items()}

        # Layer 1
        x_dict = self.conv1(x_dict, edge_index_dict)
        x_dict = {key: F.elu(x) for key, x in x_dict.items()}
        x_dict = {key: F.dropout(x, p=0.3, training=self.training) for key, x in x_dict.items()}

        # Layer 2
        x_dict = self.conv2(x_dict, edge_index_dict)

        return x_dict

    def get_embeddings(self, x_dict: dict[str, torch.Tensor],
                       edge_index_dict: dict[tuple, torch.Tensor]) -> torch.Tensor:
        """Extract customer embeddings (detached, on CPU)."""
        self.eval()
        with torch.no_grad():
            out = self.forward(x_dict, edge_index_dict)
        return out['customer'].cpu()

    def predict(self, x_dict: dict[str, torch.Tensor],
                edge_index_dict: dict[tuple, torch.Tensor]) -> tuple[dict, torch.Tensor]:
        """
        Forward + classification logits.

        Returns:
            (embedding_dict, logits) where logits is Tensor[N, 2]
        """
        emb_dict = self.forward(x_dict, edge_index_dict)
        logits = self.classifier(emb_dict['customer'])
        return emb_dict, logits
