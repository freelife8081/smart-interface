let provider, signer, contract, currentAddress = null;
let pendingFn = null;
let tokenDecimals = 18;

document.getElementById("connectWallet").onclick = async () => {
  if (!window.ethereum) return alert("MetaMask not detected.");
  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  currentAddress = await signer.getAddress();
  document.getElementById("walletAddress").innerText = `Connected: ${currentAddress}`;
};

async function loadContract() {
  const abiText = document.getElementById("abiInput").value;
  const contractAddr = document.getElementById("contractAddressInput").value;
  try {
    if (!ethers.utils.isAddress(contractAddr)) {
      alert("Invalid contract address");
      return;
    }
    const abi = JSON.parse(abiText);
    contract = new ethers.Contract(contractAddr, abi, signer);
    try {
      tokenDecimals = await contract.decimals();
    } catch {
      tokenDecimals = 18;
    }
    displayFunctionTabs(abi);
    displayFunctions(abi, "all");
  } catch (err) {
    alert("Error loading contract: " + err.message);
  }
}

function displayFunctionTabs(abi) {
  const tabs = document.getElementById("functionTabs");
  tabs.innerHTML = "";
  const types = ["all", "mint", "burn", "transfer"];

  types.forEach(type => {
    const btn = document.createElement("button");
    btn.innerText = type.toUpperCase();
    btn.onclick = () => {
      document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active-tab"));
      btn.classList.add("active-tab");
      displayFunctions(abi, type);
    };
    if (type === "all") btn.classList.add("active-tab");
    tabs.appendChild(btn);
  });
}

function displayFunctions(abi, filter) {
  const container = document.getElementById("functionsContainer");
  container.innerHTML = "";
  abi.filter(f => f.type === "function").forEach(fn => {
    if (filter !== "all" && !fn.name.toLowerCase().includes(filter)) return;

    const box = document.createElement("div");
    box.className = "function-box";

    const header = document.createElement("div");
    header.className = "function-header";
    header.innerText = `${fn.name} (${fn.stateMutability})`;
    box.appendChild(header);

    const body = document.createElement("div");
    body.className = "function-body";

    const inputElems = fn.inputs.map((input, idx) => {
      const label = document.createElement("label");
      label.innerText = `${input.name || "param"} (${input.type})`;
      const inp = document.createElement("input");
      inp.dataset.index = idx;
      inp.dataset.type = input.type;
      inp.dataset.name = input.name || "";
      body.appendChild(label);
      body.appendChild(inp);
      return inp;
    });

    const gasInfo = document.createElement("div");
    gasInfo.className = "gas-info";
    body.appendChild(gasInfo);

    inputElems.forEach(inp => {
      inp.oninput = async () => {
        try {
          const args = inputElems.map(i => convertType(i.value, i.dataset.type, i.dataset.name));
          let estimate = "-";
          try {
            estimate = await contract.estimateGas[fn.name](...args);
          } catch (err) {
            estimate = "Estimation Failed";
          }
          gasInfo.innerText = `Estimated Gas: ${estimate.toString()}`;
        } catch {
          gasInfo.innerText = `Estimated Gas: -`;
        }
      };
    });

    const btn = document.createElement("button");
    btn.innerText = `Execute ${fn.name}`;
    btn.onclick = () => {
      pendingFn = async () => {
        const args = inputElems.map(inp => convertType(inp.value, inp.dataset.type, inp.dataset.name));
        try {
          const result = await contract[fn.name](...args);
          if (fn.stateMutability === "view" || fn.stateMutability === "pure") {
            const output = await result;
            document.getElementById("functionOutput").innerText = formatResult(output);
          } else {
            document.getElementById("status").innerText = "Transaction sent... awaiting confirmation";
            await result.wait();
            document.getElementById("status").innerText = "Transaction confirmed.";
          }
        } catch (err) {
          document.getElementById("status").innerText = "Error: " + err.message;
        }
      };
      document.getElementById("modalText").innerText = `Are you sure you want to execute ${fn.name}?`;
      openModal();
    };

    body.appendChild(btn);
    box.appendChild(body);
    header.onclick = () => body.style.display = body.style.display === "block" ? "none" : "block";
    container.appendChild(box);
  });
}

function convertType(value, type, nameHint = "") {
  if (type.includes("int")) {
    if (nameHint.toLowerCase().includes("amount") || nameHint.toLowerCase().includes("value")) {
      return ethers.utils.parseUnits(value, tokenDecimals);
    }
    return ethers.BigNumber.from(value);
  }
  if (type === "bool") return value.toLowerCase() === "true";
  if (type === "address") return value.toLowerCase();
  return value;
}

function formatResult(result) {
  if (Array.isArray(result)) {
    return JSON.stringify(result.map(r => {
      return (r._isBigNumber)
        ? ethers.utils.formatUnits(r, tokenDecimals)
        : r.toString();
    }), null, 2);
  }

  if (result && typeof result === "object") {
    if (result._isBigNumber) {
      return ethers.utils.formatUnits(result, tokenDecimals);
    }

    return JSON.stringify(result, (key, value) => {
      if (value && typeof value === "object" && value._isBigNumber) {
        return ethers.utils.formatUnits(value, tokenDecimals);
      }
      return value;
    }, 2);
  }

  return result.toString();
}

// Modal control
function openModal() {
  document.getElementById("confirmModal").style.display = "block";
}
function closeModal() {
  document.getElementById("confirmModal").style.display = "none";
}
document.getElementById("confirmExecute").onclick = () => {
  if (pendingFn) pendingFn();
  closeModal();
};
