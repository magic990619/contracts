/* eslint-env mocha */
/* global artifacts, contract, web3, it, beforeEach */
const hre = require("hardhat");
const { assert, expect } = require("chai");
const { expectRevert, expectEvent } = require("@openzeppelin/test-helpers");

const { impersonate } = require("../../helpers/impersonate");
const constants = require("../../helpers/constants");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { getContractFactory } = require("@nomiclabs/hardhat-ethers/types");
const { address } = require("../../helpers/constants");
const ethers = hre.ethers;

describe("FactoryRouter", () => {
  let name,
    symbol,
    owner,
    reciever,
    metadata,
    tokenERC721,
    tokenAddress,
    data,
    flags,
    factoryERC721,
    factoryERC20,
    templateERC721,
    templateERC20,
    newERC721Template,
    router,
    poolFactory,
    oceanContract,
    erc20DTContract,
    vault,
    fork

  const oceanAddress = "0x967da4048cd07ab37855c090aaf366e4ce1b9f48";
  const daiAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
  const usdcAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  const communityFeeCollector = "0xeE9300b7961e0a01d9f0adb863C7A227A07AaD75";
 

  beforeEach("init contracts for each test", async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/eOqKsGAdsiNLCVm846Vgb-6yY3jlcNEo",
          blockNumber: 12515000,
        }
      }]
    })

    const ERC721Template = await ethers.getContractFactory("ERC721Template");
    const ERC20Template = await ethers.getContractFactory("ERC20Template");
    const ERC721Factory = await ethers.getContractFactory("ERC721Factory");

    const Metadata = await ethers.getContractFactory("Metadata");
    const Router = await ethers.getContractFactory("FactoryRouter");
    const SSContract = await ethers.getContractFactory("ssFixedRate");
    const BPool = await ethers.getContractFactory("BPool");
    const FixedRateExchange = await ethers.getContractFactory(
      "FixedRateExchange"
    );

  

    [
      owner, // nft owner, 721 deployer
      reciever,
      user2, // 721Contract manager
      user3, // pool creator and liquidity provider
      user4,
      user5,
      user6,
      marketFeeCollector,
      opfCollector,
    ] = await ethers.getSigners();
    
    data = web3.utils.asciiToHex("SomeData");
    flags = web3.utils.asciiToHex(constants.blob[0]);
       
   // DEPLOY ROUTER, SETTING OWNER

  poolTemplate = await BPool.deploy();

 


  router = await Router.deploy(
    owner.address,
    oceanAddress,
    poolTemplate.address, // pooltemplate field, unused in this test
    opfCollector.address,
    []
  );

  ssFixedRate = await SSContract.deploy(router.address);

  fixedRateExchange = await FixedRateExchange.deploy(
    router.address,
    opfCollector.address
  );

  templateERC20 = await ERC20Template.deploy();

  metadata = await Metadata.deploy();

  // SETUP ERC721 Factory with template
  templateERC721 = await ERC721Template.deploy();
  factoryERC721 = await ERC721Factory.deploy(
    templateERC721.address,
    templateERC20.address,
    opfCollector.address,
    router.address,
    metadata.address
  );

  // SET REQUIRED ADDRESS

  await metadata.addTokenFactory(factoryERC721.address);

  await router.addFactory(factoryERC721.address);

  await router.addFixedRateContract(fixedRateExchange.address);
    
  await router.addSSContract(ssFixedRate.address)
  
  const tx = await factoryERC721.deployERC721Contract(
      "DT1",
      "DTSYMBOL",
      data,
      flags,
      1
    );
    const txReceipt = await tx.wait();

    tokenAddress = txReceipt.events[4].args[0];
    tokenERC721 = await ethers.getContractAt("ERC721Template", tokenAddress);
    symbol = await tokenERC721.symbol();
    name = await tokenERC721.name();
    assert(name === "DT1");
    assert(symbol === "DTSYMBOL");
    assert((await tokenERC721.balanceOf(owner.address)) == 1);
    
  //   // INITIAL SET UP, THE MANAGER ADDS A NEW ROLE FOR ITSELF (erc20Deployer role)
  //   await tokenERC721.addToCreateERC20List(owner.address);
    
  //   // WE THEN CREATE A NEW ERC20 CONTRACT
  //   let receipt = await (
  //   await tokenERC721.createERC20(
  //       "ERC20DT1",
  //       "ERC20DT1Symbol",
  //       web3.utils.toWei("1000"),
  //       1,
  //       owner.address,
  //       user3.address
  //     )
  //   ).wait();
  //   const newERC20DT = receipt.events[3].args.erc20Address;

  //   erc20DTContract = await ethers.getContractAt(
  //     "ERC20Template",
  //     newERC20DT
  //   );

  //   // WE ADD OURSELF AS MINTER AND THEN MINT SOME ERC20 DATATOKEN.
  //   //await erc20DTContract.addMinter(owner.address);
  //   await erc20DTContract.mint(owner.address, web3.utils.toWei("100"));
  //   assert(await erc20DTContract.balanceOf(owner.address) == web3.utils.toWei("100"))

   

  });


  it("#oceanTokens - should confirm Ocean token has been added to the mapping",async () => {
    assert(await router.oceanTokens(oceanAddress) == true);
  })

  it("#addOceanToken - should add a new token address to the mapping if Router Owner",async () => {
    assert(await router.oceanTokens(user2.address) == false);
    await router.addOceanToken(user2.address)
    assert(await router.oceanTokens(user2.address) == true);
  })

  it("#addOceanToken - should fail to add a new token address to the mapping if NOT Router Owner",async () => {
    await expectRevert(router.connect(user2).addOceanToken(user2.address), "OceanRouter: NOT OWNER")
    assert(await router.oceanTokens(user2.address) == false);
   
  })

  it("#ssContracts - should confirm ssContract token has been added to the mapping",async () => {
    assert(await router.ssContracts(ssFixedRate.address) == true);
  })

  it("#addSSContract - should add a new ssContract address to the mapping if Router Owner",async () => {
    assert(await router.ssContracts(user2.address) == false);
    await router.addSSContract(user2.address)
    assert(await router.ssContracts(user2.address) == true);
  })

  it("#addSSContract - should fail to add a new ssContract address to the mapping if NOT Router Owner",async () => {
    await expectRevert(router.connect(user2).addSSContract(user2.address), "OceanRouter: NOT OWNER")
    assert(await router.ssContracts(user2.address) == false);
   
  })

  it("#addFactory - should fail to add a new factory address to the mapping even if Router Owner",async () => {
    await expectRevert(router.addFactory(user2.address), "FACTORY ALREADY SET")
    assert(await router.factory() == factoryERC721.address);
   
  })

  it("#addFactory - should fail to add a new factory address to the mapping even if NOT Router Owner",async () => {
    await expectRevert(router.connect(user2).addFactory(user2.address), "OceanRouter: NOT OWNER")
    assert(await router.factory() == factoryERC721.address);
   
  })

  it("#fixedRate- should confirm ssContract token has been added to the mapping",async () => {
    assert(await router.fixedPrice(fixedRateExchange.address) ==true )
  })

 

  it("#addFixedRateContract - should fail to UPDATE fixedRateExchange contract if NOT Router Owner",async () => {
    await expectRevert(router.connect(user2).addFixedRateContract(user2.address), "OceanRouter: NOT OWNER")
    assert(await router.fixedPrice(user2.address) ==false)
   
  })




});


