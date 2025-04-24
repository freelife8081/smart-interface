let provider, signer, contract, currentAddress, ownerAddress = null;

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
    const abi = JSON.parse(abiText);
    contract = new ethers.Contract(contractAddr, abi, signer);
    await checkOwner();
    displayFunctionTabs(abi);
    displayFunctions(abi, "all");
  } catch (err) {
    alert("Error loading contract: " + err.message);
  }
}

async function checkOwner() {
  try {
    ownerAddress = await contract.owner();
  } catch {
    ownerAddress = null;
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
    const isOwnerOnly = ["mint", "burn"].includes(fn.name.toLowerCase());
    if (isOwnerOnly && ownerAddress && currentAddress.toLowerCase() !== ownerAddress.toLowerCase()) return;
    if (filter !== "all" && !fn.name.toLowerCase().includes(filter)) return;

    const wrapper = document.createElement("div");
    wrapper.className = "function-box";

    const header = document.createElement("div");
    header.className = "function-header";
    header.innerText = `${fn.name} (${fn.stateMutability})`;
    header.onclick = () => {
      const body = wrapper.querySelector(".function-body");
      body.style.display = body.style.display === "block" ? "none" : "block";
    };

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

    const btn = document.createElement("button");
    btn.innerText = `Execute ${fn.name}`;
    btn.onclick = async () => {
      const args = inputElems.map(inp => convertType(inp.value, inp.dataset.type, inp.dataset.name));
      if (fn.stateMutability === "view" || fn.stateMutability === "pure") {
        try {
          const result = await contract[fn.name](...args);
          document.getElementById("functionOutput").innerText = formatResult(result);
        } catch (err) {
          document.getElementById("status").innerText = "Error: " + err.message;
        }
      } else {
        try {
          const estimatedGas = await contract.estimateGas[fn.name](...args);
          showModal(fn.name, estimatedGas, async () => {
            const tx = await contract[fn.name](...args);
            document.getElementById("status").innerText = "Transaction sent... awaiting confirmation";
            await tx.wait();
            document.getElementById("status").innerText = "Transaction confirmed.";
          });
        } catch (err) {
          document.getElementById("status").innerText = "Error estimating gas or executing: " + err.message;
        }
      }
    };

    body.appendChild(btn);
    wrapper.appendChild(header);
    wrapper.appendChild(body);
    container.appendChild(wrapper);
  });
}

function convertType(value, type, nameHint = "") {
  if (type.includes("int")) {
    if (nameHint.toLowerCase().includes("amount") || nameHint.toLowerCase().includes("value")) {
      return ethers.utils.parseUnits(value, 18); // assumes 18 decimals
    }
    return ethers.BigNumber.from(value);
  }
  if (type === "bool") return value.toLowerCase() === "true";
  if (type === "address") return value.toLowerCase();
  return value;
}

function formatResult(result) {
  if (Array.isArray(result)) return JSON.stringify(result.map(r => r.toString()), null, 2);
  if (typeof result === "object") return JSON.stringify(result, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2);
  return result.toString();
}

function showModal(functionName, gas, onConfirm) {
  document.getElementById("modalFunctionName").innerText = `Function: ${functionName}`;
  document.getElementById("modalGas").innerText = gas.toString();
  document.getElementById("confirmModal").style.display = "block";

  document.getElementById("confirmYes").onclick = () => {
    document.getElementById("confirmModal").style.display = "none";
    onConfirm();
  };
  document.getElementById("confirmNo").onclick = () => {
    document.getElementById("confirmModal").style.display = "none";
  };
}
