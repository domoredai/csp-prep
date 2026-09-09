/*=============================================
   CSP Exam Prep — Vocabulary Engine v1.0
   Adds bilingual terms to quizzes, flashcards,
   a floating vocabulary widget, and localStorage
   persistence of saved words.
   =============================================*/

(function() {
  'use strict';

  const STORAGE_KEY_VOCAB = 'csp_vocab_list';

  // ============ VOCAB LIST ============
  // Central glossary: all bilingual terms
  // Used by: vocab widget, flashcard system, glossary page, inline term highlighting
  const GLOSSARY = [
    // Domain 1
    { en: "Hierarchy of Controls", zh: "控制层级", domain: "1", desc: "A framework ranking hazard controls from most to least effective: Elimination → Substitution → Engineering → Administrative → PPE", descZh: "控制层级是管理工作场所危害的基本框架，按从最有效到最不有效的顺序排列，依次为消除、替代、工程控制、行政控制和个人防护装备（PPE），选择控制措施时应优先采用层级靠前的方法。" },
    { en: "Elimination", zh: "消除", domain: "1", desc: "Physically removing the hazard; the most effective control", descZh: "消除是指从根本上移除工作场所中的危害，如用无害工艺替代危险工艺或将设备移出操作区域，是控制层级中效力最高、最被推荐的策略。" },
    { en: "Substitution", zh: "替代", domain: "1", desc: "Replacing a hazardous material, process, or equipment with a less hazardous alternative", descZh: "替代是用危害更小的物料、工艺或设备替换原有危险品，例如用水性涂料替代溶剂型涂料，其效力仅次于消除。" },
    { en: "Engineering Controls", zh: "工程控制", domain: "1", desc: "Physical changes to the workplace that isolate workers from hazards", descZh: "工程控制是通过对设备、设施或工艺流程进行物理性改造来隔离员工与危害，例如加装通风系统、防护罩和隔音屏障，属于控制层级中第三有效的措施。" },
    { en: "Administrative Controls", zh: "行政控制", domain: "1", desc: "Work procedures, policies, and scheduling changes that reduce exposure", descZh: "行政控制通过工作程序、政策、轮班安排和培训等管理手段降低员工暴露，如缩短作业时间、张贴警示标志和轮换岗位，但不能从源头消除危害。" },
    { en: "Personal Protective Equipment (PPE)", zh: "个人防护装备", domain: "1", desc: "Equipment worn by individuals to protect against hazards; last line of defense", descZh: "个人防护装备是员工穿戴用以抵御危害的最后一道防线，包括安全帽、护目镜、耳塞、手套和防护服等，须经正确选型、合身和培训后才能有效。" },
    { en: "Prevention through Design (PtD)", zh: "预防性设计", domain: "1", desc: "Addressing safety and health hazards during the design phase of facilities, processes, and equipment", descZh: "预防性设计强调在设施、工艺和设备的规划设计阶段即纳入安全和健康考虑，从源头减少或消除危害，是一种比控制层级更上游的风险预防理念。" },
    { en: "Process Safety Management (PSM)", zh: "工艺安全管理", domain: "1", desc: "OSHA standard 29 CFR 1910.119; 14 elements for managing highly hazardous chemicals", descZh: "工艺安全管理是美国OSHA标准29 CFR 1910.119规定的管理体系，适用于含有高度危险化学品的工艺，共包含工艺安全信息、工艺危害分析、变更管理等14个要素。" },
    { en: "Management of Change (MOC)", zh: "变更管理", domain: "1", desc: "A systematic review of proposed changes to processes, equipment, or procedures before implementation", descZh: "变更管理是对工艺、设备、程序或人员提出的拟议变更，在实施前进行系统评审、审批和文件化的流程，目的是防止因未受控变更引发工艺安全事故。" },
    { en: "Process Hazard Analysis (PHA)", zh: "工艺危害分析", domain: "1", desc: "A systematic assessment of potential hazard scenarios in a process", descZh: "工艺危害分析是对工艺中潜在危害情景进行系统评估的方法，常用技术包括HAZOP、What-If和故障假设分析，是PSM体系的核心要素之一。" },
    { en: "Lockout/Tagout (LOTO)", zh: "上锁挂牌", domain: "1", desc: "OSHA 29 CFR 1910.147; a 6-step procedure to control hazardous energy during service and maintenance", descZh: "上锁挂牌是美国OSHA标准29 CFR 1910.147规定的控制危险能量（电能、机械能、液压能、热能等）的六步程序，在设备维修保养前执行，包括准备、关断、隔离、上锁挂牌、验证和恢复六个步骤。" },
    { en: "Confined Space", zh: "密闭空间", domain: "1", desc: "A space large enough to enter, with limited entry/exit, not designed for continuous occupancy", descZh: "密闭空间是指足够大可供人员进入、出入口受限、且非设计用于人员连续停留的空间，如储罐、管道、检修井等，可能存在缺氧、有毒气体和可燃气体等危害。" },
    { en: "Permit-Required Confined Space", zh: "许可证要求的密闭空间", domain: "1", desc: "Contains or may contain a hazardous atmosphere, engulfment hazard, converging walls, or other serious hazard", descZh: "许可证要求的密闭空间是指其中含有或可能含有危险大气、吞没危险、内缩墙面或其他严重危害的密闭空间，进入前须办理书面许可、进行大气检测并安排监护人员。" },
    { en: "Excavation", zh: "挖掘", domain: "1", desc: "Any man-made cut, cavity, trench, or depression in the earth's surface", descZh: "挖掘指任何人工在地表形成的切口、洞穴、沟槽或凹陷，深度超过1.2米（4英尺）时一般须采取支护、放坡等防护措施，OSHA 29 CFR 1926 Subpart P对其有专门规定。" },
    { en: "Arc Flash", zh: "弧闪", domain: "1", desc: "A sudden release of electrical energy through the air; NFPA 70E defines protection boundaries", descZh: "弧闪是电能通过空气突然释放的现象，可产生极高温度和强光、压力波，NFPA 70E标准规定了电弧危害边界（闪络保护边界、限制边界等）及对应等级的PPE要求。" },
    { en: "Fall Protection", zh: "坠落防护", domain: "1", desc: "Systems to prevent or arrest falls from heights; governed by 29 CFR 1926 Subpart M", descZh: "坠落防护是防止人员从高处坠落或限制坠落后果的系统，依据OSHA 29 CFR 1926 Subpart M，建筑作业在1.8米（6英尺）以上须提供坠落防护措施。" },
    { en: "Guardrail", zh: "护栏", domain: "1", desc: "A barrier system with top rail (42 inches), midrail, and toeboard to prevent falls", descZh: "护栏系统由顶部横杆（距作业面0.9米即42英寸）、中间横杆和踢脚板组成，用于防止人员从高处或平台边缘坠落，是常用的被动式坠落防护措施。" },
    { en: "Personal Fall Arrest System (PFAS)", zh: "个人防坠系统", domain: "1", desc: "Full-body harness, lanyard, and anchorage (5,000 lbs) to arrest a fall", descZh: "个人防坠系统由全身式安全带、系索和锚固点构成，锚固点须能承受至少2268千克（5000磅）载荷，用于在坠落发生时及时止住人员并限制坠落距离。" },
    { en: "Machine Guarding", zh: "机械防护", domain: "1", desc: "Guards or devices protecting workers from hazardous machine parts (rotating, shearing, cutting points)", descZh: "机械防护是通过在设备的危险运动部位（如旋转轴、齿轮、皮带、剪切点和挤压点）安装护罩、屏障或安全装置，防止操作人员接触危险点，OSHA 29 CFR 1910 Subpart O对此有专门要求。" },
    { en: "Interlock", zh: "联锁", domain: "1", desc: "A safety device that prevents machine operation when a guard is open or a hazard is present", descZh: "联锁装置是一种安全保护装置，当机器处于危险状态时阻止其启动，或在危险防护罩打开、人员进入危险区时自动切断动力，例如压力机防护门联锁开关。" },
    { en: "Scaffold", zh: "脚手架", domain: "1", desc: "A temporary elevated work platform; governed by OSHA 29 CFR 1926 Subpart L", descZh: "脚手架是建筑施工中为人员和材料提供临时工作平台的结构，OSHA 29 CFR 1926 Subpart L规定其承载能力（至少为设计载荷的4倍）、护栏设置、底座支撑和由称职人员搭设与检查等要求，防止坍塌和坠落。" },
    { en: "Crane", zh: "起重机", domain: "1", desc: "Equipment for lifting and moving heavy loads; OSHA 29 CFR 1926 Subpart CC applies", descZh: "起重机是用于吊运重物的机械，包括移动式、塔式和履带式等类型，操作须遵守OSHA 29 CFR 1926 Subpart CC，操作人员和信号员须持证，并防止吊臂吊物接触电线、超载倾覆等危险。" },
    { en: "Rigging", zh: "吊装索具", domain: "1", desc: "Slings, chains, hooks, and other hardware used to connect a load to lifting equipment", descZh: "吊装索具是连接起重机与吊物的钢丝绳吊索、合成纤维吊带、卸扣、吊钩等配件，须按额定载荷选型、正确捆绑并定期检查，防止因超载、磨损或角度不当导致吊物坠落。" },
    { en: "Forklift", zh: "叉车", domain: "1", desc: "Powered industrial truck for moving materials; operator training per 29 CFR 1910.178", descZh: "叉车是工业中常见的物料搬运设备，OSHA 29 CFR 1910.178规定操作人员须经培训并取得认证，须重点防范翻车、撞击行人和荷载坠落，并注意作业区通风与分隔。" },
    { en: "Aerial Lift", zh: "高空作业平台", domain: "1", desc: "Vehicle-mounted or self-propelled elevating work platform; ANSI A92 standards apply", descZh: "高空作业平台是将人员举升至高处作业的设备，包括剪叉式、臂架式和伸缩式等，操作时须遵守ANSI A92标准，防止倾覆、触电和坠落，并系挂安全带。" },
    { en: "Hot Work", zh: "动火作业", domain: "1", desc: "Work involving open flames, sparks, or heat such as welding, cutting, and grinding", descZh: "动火作业指涉及明火、火花或高温的作业（如焊接、切割、打磨和钎焊），在可燃物附近或危险区域进行须取得动火许可证，并对周围可燃物进行清理、覆盖或隔离，配备灭火器。" },
    { en: "Chemical Compatibility", zh: "化学相容性", domain: "1", desc: "Whether two or more chemicals can be stored or mixed safely without hazardous reactions", descZh: "化学相容性指不同化学品之间接触时不发生危险反应（如燃烧、爆炸、产生有毒气体）的性质，储存和使用时须依据相容性分组（如氧化剂与还原剂、酸与碱分开存放），防止意外混合。" },
    { en: "Competent Person", zh: "称职人员", domain: "1", desc: "One who can identify existing and predictable hazards and has authority to take corrective action", descZh: "称职人员指经培训和授权，能够识别现有及潜在危害、并有权立即采取纠正措施的人员，OSHA多项标准（如挖掘、脚手架和密闭空间）均要求由称职人员负责现场安全。" },
    { en: "Atmospheric Testing", zh: "大气检测", domain: "1", desc: "Testing air for oxygen, flammability, and toxic gases before and during entry into confined spaces", descZh: "大气检测是在进入密闭空间或受限区域前，对氧气浓度（正常19.5%-23.5%）、可燃气体（低于其爆炸下限的10%）和有毒气体进行检测的过程，须按上部、中部和下部三个层次检测，检测合格后方可进入并持续监测。" },

    // Domain 2
    { en: "ISO 45001", zh: "ISO 45001标准", domain: "2", desc: "International standard for Occupational Health and Safety management systems; uses PDCA cycle", descZh: "ISO 45001是国际标准化组织发布的职业健康安全管理体系标准，采用PDCA循环（策划-实施-检查-处置），2018年替代OHSAS 18001，企业通过建立、实施和持续改进该体系来提升安全绩效。" },
    { en: "Plan-Do-Check-Act (PDCA)", zh: "策划-实施-检查-处置循环", domain: "2", desc: "The continuous improvement cycle at the core of ISO 45001 and ANSI Z10.0", descZh: "策划-实施-检查-处置循环是ISO 45001和ANSI Z10.0等安全管理体系标准的核心持续改进模型，通过四个阶段不断循环迭代，推动安全管理绩效的持续提升。" },
    { en: "Audit", zh: "审核", domain: "2", desc: "A systematic, independent, and documented process for obtaining evidence and evaluating it objectively", descZh: "审核是一种系统、独立且有文件记录的评估过程，通过收集客观证据并对照准则（标准、法规或程序）进行判断，用于验证安全管理体系的有效性、符合性和持续改进机会。" },
    { en: "Leading Indicator", zh: "领先指标", domain: "2", desc: "Proactive, preventive metrics that predict future safety performance", descZh: "领先指标是主动性的、预防性的度量指标，如培训完成率、隐患排查次数、安全观察和安全领导力巡查次数，用于预测和驱动未来的安全绩效，而非反映过去。" },
    { en: "Lagging Indicator", zh: "滞后指标", domain: "2", desc: "Reactive metrics that measure past safety outcomes (injuries, incidents)", descZh: "滞后指标是反应性的度量指标，衡量过去已发生的安全结果，如伤亡事故数、TRIR和DART率，反映的是历史表现，不能预警未来的风险。" },
    { en: "Total Recordable Incident Rate (TRIR)", zh: "总可记录事故率", domain: "2", desc: "TRIR = (Number of recordable cases × 200,000) / Total hours worked", descZh: "总可记录事故率是衡量企业安全绩效的常用指标，计算公式为（可记录事故数×200000）÷总工时，其中200000代表100名全职员工每周40小时、一年50周的工作小时数。" },
    { en: "DART Rate", zh: "DART率", domain: "2", desc: "Days Away, Restricted, or Transferred rate = (DART cases × 200,000) / Hours worked", descZh: "DART率指离岗、受限或转岗天数比率，计算公式为（DART案例数×200000）÷总工时，衡量造成工作日损失、工作受限或岗位调动的伤害事故频率，比TRIR更能反映严重程度。" },
    { en: "Root Cause Analysis (RCA)", zh: "根源分析", domain: "2", desc: "A systematic process to identify the underlying causes of an incident, not just symptoms", descZh: "根源分析是识别事故或事件根本原因而非表面症状的系统化过程，常用的工具包括5问法、鱼骨图和故障树分析，目的是找出可纠正的系统性缺陷，防止同类事故再次发生。" },
    { en: "5 Whys", zh: "5问法", domain: "2", desc: "A simple RCA technique: ask 'why' repeatedly (typically 5 times) until the root cause is uncovered", descZh: "5问法是一种简单有效的根源分析技术，通过连续（通常5次）追问'为什么'，从表象问题逐层深入，直至找到问题的根本原因，常与鱼骨图、纠正措施结合使用。" },
    { en: "Fishbone Diagram", zh: "鱼骨图", domain: "2", desc: "Also called Ishikawa diagram; categorizes causes into People, Equipment, Methods, Materials, Environment, Measurement", descZh: "鱼骨图又称石川图或因果图，将可能导致问题的原因按人、设备、方法、物料、环境和测量六个大类进行分类梳理，直观展示各潜在原因与问题结果之间的因果关系。" },
    { en: "Return on Investment (ROI)", zh: "投资回报率", domain: "2", desc: "ROI = (Gain - Cost) / Cost; used to justify safety expenditures", descZh: "投资回报率是评价安全投入经济效益的指标，计算公式为（收益-成本）÷成本，用于向管理层量化安全支出带来的损失减少与收益提升，以论证安全投资的合理性与价值。" },
    { en: "Voluntary Protection Program (VPP)", zh: "自愿保护计划", domain: "2", desc: "OSHA program recognizing employers with exemplary safety and health management systems", descZh: "自愿保护计划是OSHA推出的项目，对建立并有效运行卓越安全健康管理体系的雇主给予认证认可，符合条件的现场可豁免定期检查，分为星标（Star）、优标（Merit）等不同等级。" },
    { en: "Hierarchy of Needs", zh: "需求层次理论", domain: "2", desc: "Maslow's theory: physiological → safety → belonging → esteem → self-actualization", descZh: "马斯洛需求层次理论将人的需求从低到高分为生理、安全、归属、尊重和自我实现五个层次，安全需求位于第二层，说明在满足基本生理需求后，人们才会追求安全，可用于理解员工行为与激励。" },
    { en: "Gap Analysis", zh: "差距分析", domain: "2", desc: "Comparison of current state against a desired standard or target to identify deficiencies", descZh: "差距分析是通过比较组织现状与目标（如法规要求、ISO标准或行业最佳实践）之间的差距，识别需要改进的方向和优先事项的方法，常用于安全管理体系的初始评审和持续改进。" },
    { en: "Benchmarking", zh: "对标管理", domain: "2", desc: "Comparing one's practices and performance with industry leaders to learn and improve", descZh: "对标管理是将本组织的安全管理实践和绩效指标与行业内优秀组织或最佳实践进行对比，找出差距并学习借鉴成功经验，以持续提升安全绩效和运营水平。" },
    { en: "Key Performance Indicator (KPI)", zh: "关键绩效指标", domain: "2", desc: "Quantifiable measures used to evaluate the success of an organization in achieving safety objectives", descZh: "关键绩效指标是可量化、可衡量的安全绩效指标，如TRIR、DART率、培训完成率、隐患整改率和安全审计得分，用于跟踪目标达成情况并评价管理措施的效果。" },
    { en: "Incident Investigation", zh: "事故调查", domain: "2", desc: "A systematic process of gathering evidence, determining causes, and recommending corrective actions", descZh: "事故调查是通过现场取证、访谈和资料分析来还原事件经过，识别直接原因和根本原因并提出纠正措施的系统过程，其目的是防止同类事故再次发生，而非追究个人责任。" },
    { en: "Corrective Action", zh: "纠正措施", domain: "2", desc: "Actions taken to eliminate the cause of a detected nonconformity or incident to prevent recurrence", descZh: "纠正措施是针对已识别的不符合或事故原因所采取的消除性措施，防止问题再次发生，通常需明确责任人、完成时限，并通过跟踪验证确认措施有效。" },
    { en: "Preventive Action", zh: "预防措施", domain: "2", desc: "Proactive actions taken to eliminate potential causes of nonconformity before problems occur", descZh: "预防措施是为消除潜在不符合或隐患的原因而主动采取的措施，目的是在问题发生之前加以防范，与针对已发生问题的纠正措施相区别，体现预防为主的管理理念。" },
    { en: "Management Review", zh: "管理评审", domain: "2", desc: "Top management's periodic evaluation of the OHS management system's suitability and effectiveness", descZh: "管理评审是最高管理层定期对安全管理体系的适宜性、充分性和有效性进行的评审活动，通常审查绩效数据、审核结果、合规情况和持续改进机会，并据此做出资源投入等决策。" },
    { en: "Document Retention", zh: "文件保存", domain: "2", desc: "Policy on how long records must be kept; governed by regulations such as 29 CFR 1910.1020", descZh: "文件保存指按规定期限保存安全记录、培训证明、体检报告、检测数据和事故档案等文件的制度，保留期限由法规（如OSHA 29 CFR 1910.1020规定暴露记录保存30年）和公司政策确定。" },
    { en: "Trade Secret", zh: "商业秘密", domain: "2", desc: "Confidential business information; SDS may withhold exact identity but must disclose to medical personnel", descZh: "商业秘密指不对外公开的具有商业价值的信息，SDS供应商可主张化学成分或配比为商业秘密而不详细披露，但发生医疗紧急情况时仍须向医护人员提供必要的信息。" },
    { en: "Confidentiality", zh: "保密性", domain: "2", desc: "Protecting sensitive information such as health records, trade secrets, and investigation findings", descZh: "保密性指保护敏感信息（如员工健康记录、商业秘密、事故调查资料和举报人信息）不被未经授权披露的原则，员工体检和健康记录通常须对雇主和管理层保密，防止歧视与误用。" },
    { en: "RACI Chart", zh: "责任分配矩阵", domain: "2", desc: "A matrix assigning Responsible, Accountable, Consulted, Informed roles to each task", descZh: "责任分配矩阵用责任（R-Responsible）、负责（A-Accountable）、咨询（C-Consulted）和知情（I-Informed）四种角色标注每项任务的相关人员，用于明确分工、避免权责不清和沟通遗漏。" },
    { en: "Pareto Analysis", zh: "帕累托分析", domain: "2", desc: "The 80/20 rule: focus on the few causes responsible for most of the problems", descZh: "帕累托分析基于'80/20法则'，即80%的事故或损失往往由20%的原因造成，通过排列图（柱状图加累计曲线）找出最主要的少数原因，从而把有限的资源集中在最有效的改进上。" },
    { en: "Standard Deviation", zh: "标准差", domain: "2", desc: "A measure of the dispersion or spread of a set of data values around the mean", descZh: "标准差是衡量一组数据围绕平均值离散程度的统计量，数值越大表示数据波动越大，在安全数据（如暴露测量、事故率分析）中用于判断数据的稳定性和可信区间。" },
    { en: "Confidence Interval", zh: "置信区间", domain: "2", desc: "A range of values, derived from sample data, likely to contain the true population parameter", descZh: "置信区间是由样本数据计算出的一个数值区间，表示在给定置信水平（如95%）下真实总体参数落入该区间的把握，用于评估统计结果的不确定性，如推断总体事故率或暴露水平。" },

    // Domain 3
    { en: "Risk Assessment", zh: "风险评估", domain: "3", desc: "The process of identifying hazards, analyzing risks, and evaluating their acceptability", descZh: "风险评估是识别危害、分析风险大小并评价风险是否可接受的过程，通常分为危害识别、风险分析和风险评价三步，是风险管理决策和确定控制措施优先级的基础。" },
    { en: "Job Hazard Analysis (JHA)", zh: "工作危害分析", domain: "3", desc: "A technique to identify hazards in each step of a job and develop controls", descZh: "工作危害分析是将某项工作分解为若干步骤，对每一步骤识别潜在危害并制定相应控制措施的作业级风险分析技术，常用于现场作业、维修和非常规任务的风险评估。" },
    { en: "Risk Matrix", zh: "风险矩阵", domain: "3", desc: "A grid (3×3, 4×4, or 5×5) combining likelihood and severity to rate risk levels", descZh: "风险矩阵是由可能性和严重度两轴组成的网格（常见3×3、4×4或5×5），将两者组合以划分风险等级（如低、中、高、极高），帮助确定风险处理的优先级和所需的控制层级。" },
    { en: "ALARP", zh: "合理可行尽量降低", domain: "3", desc: "As Low As Reasonably Practicable — a risk acceptance principle", descZh: "合理可行尽量降低原则（ALARP）是英国等地采用的风险接受准则，要求在降低风险所需的成本与所获安全效益之间进行权衡，将风险降至合理可行的最低水平，广泛用于高后果行业（如石油、化工、核电）。" },
    { en: "Failure Mode and Effects Analysis (FMEA)", zh: "失效模式与影响分析", domain: "3", desc: "RPN = Severity × Occurrence × Detection; identifies potential failure modes and their effects", descZh: "失效模式与影响分析是一种自下而上的预防性可靠性分析方法，系统识别系统或工艺各组成部分的潜在失效模式及其后果，并通过风险优先数（RPN=严重度×发生度×探测度）进行排序和优先级处理。" },
    { en: "Risk Priority Number (RPN)", zh: "风险优先数", domain: "3", desc: "RPN = S × O × D; used in FMEA to prioritize which failure modes to address first", descZh: "风险优先数用于FMEA中对失效模式进行优先级排序，计算公式为RPN=严重度(S)×发生度(O)×探测度(D)，数值越高表示风险越大、越应优先采取改进措施。" },
    { en: "Fault Tree Analysis (FTA)", zh: "故障树分析", domain: "3", desc: "Top-down, deductive method using Boolean logic to analyze what can cause a top event", descZh: "故障树分析是一种自上而下、演绎性的分析方法，以不希望发生的顶事件（如爆炸、泄漏）为起点，利用与门、或门等布尔逻辑逐层向下追溯，识别所有可能导致顶事件的基本事件组合。" },
    { en: "Event Tree Analysis (ETA)", zh: "事件树分析", domain: "3", desc: "Bottom-up, inductive method analyzing possible outcomes from an initiating event", descZh: "事件树分析是一种自下而上、归纳性的分析方法，从一个初始事件（如设备故障）出发，逐层考虑各安全系统的成功或失败，推导出所有可能的事故后果情景及其发生概率。" },
    { en: "HAZOP", zh: "危害与可操作性分析", domain: "3", desc: "Hazard and Operability study using guidewords applied to process nodes to identify deviations", descZh: "危害与可操作性分析通过将引导词（如更多、更少、无、反向、部分等）应用于工艺的各个节点，系统识别工艺参数（流量、压力、温度、液位）的偏差及其可能原因和后果，是工艺工业最常用的风险分析方法。" },
    { en: "Bow-Tie Analysis", zh: "蝴蝶结分析", domain: "3", desc: "Combines FTA (left side — threats/preventive barriers) and ETA (right side — consequences/mitigative barriers)", descZh: "蝴蝶结分析将故障树分析（左侧，威胁与预防性屏障）与事件树分析（右侧，后果与缓解性屏障）结合在同一个蝴蝶结形图形中，直观展示从危险源到后果的全过程屏障设置，便于识别屏障缺失。" },
    { en: "Risk Transfer", zh: "风险转移", domain: "3", desc: "Shifting risk to another party, typically through insurance or contract indemnification", descZh: "风险转移是通过保险合同、外包协议或免责条款等方式，将风险的全部或部分责任转给另一方承担，常见的如购买财产保险、工伤保险和将高风险作业外包，但须注意转移并不能消除风险本身。" },
    { en: "Risk Retention", zh: "风险自留", domain: "3", desc: "Accepting the financial consequences of a risk (self-insurance, deductibles)", descZh: "风险自留是组织自愿或被动地承担风险的全部或部分财务后果，形式包括建立自保基金、设置保险免赔额或直接承担损失，适用于发生频率低或损失金额可控的风险。" },
    { en: "Likelihood", zh: "可能性", domain: "3", desc: "The probability or frequency that a hazardous event will occur", descZh: "可能性是风险的构成要素之一，指危害事件发生的概率或频率，在风险矩阵中常分为极不可能、不可能、可能、很可能和几乎必然等定性等级，或用量化频率表示。" },
    { en: "Severity", zh: "严重度", domain: "3", desc: "The extent of harm that would result if a hazardous event occurred", descZh: "严重度是风险的构成要素之一，指危害事件一旦发生所造成后果的严重程度，如人员伤亡等级、财产损失金额和环境影响范围，与可能性共同决定风险等级。" },
    { en: "Residual Risk", zh: "残余风险", domain: "3", desc: "The risk remaining after controls have been applied", descZh: "残余风险是在现有控制措施实施后仍然存在的风险，若残余风险仍超出组织可接受的水平，则须追加控制措施、采取风险转移或考虑取消相关作业。" },
    { en: "Risk Register", zh: "风险登记册", domain: "3", desc: "A documented list of identified risks, their levels, controls, and owners", descZh: "风险登记册是系统记录所有已识别风险及其风险等级、现有控制措施、责任人、状态和残余风险的文档，是风险管理全生命周期（识别、分析、处置、监控）的核心管理工具。" },
    { en: "Risk Tolerance", zh: "风险容忍度", domain: "3", desc: "The level of risk an organization is willing to accept", descZh: "风险容忍度是组织愿意接受的风险水平，由管理层根据法规要求、财务能力、企业文化和对风险后果的承受能力确定，超过容忍度的风险须优先处理或转移。" },
    { en: "Cost-Benefit Analysis", zh: "成本效益分析", domain: "3", desc: "Comparing the costs of a control measure with the benefits of prevented losses", descZh: "成本效益分析是通过比较控制措施的投入成本与其减少事故损失、提升生产效率所带来收益，来判断该措施在经济上是否合理可行的决策方法，常用于向管理层论证安全投入。" },
    { en: "Insurance Deductible", zh: "保险免赔额", domain: "3", desc: "The amount of a loss the insured must pay before the insurer pays", descZh: "保险免赔额是保险事故发生后由被保险人先行自行承担的那部分损失金额，提高免赔额可降低保费支出，但同时也增加了组织自行承担的风险和损失金额。" },
    { en: "Self-Insurance", zh: "自保", domain: "3", desc: "Bearing risk losses through internally funded reserves instead of commercial insurance", descZh: "自保是组织建立专项储备基金、自行承担风险损失的做法，如大型企业为工伤赔偿实行自保，可节省保费和中介费用，但组织须具备充足的财务能力和风险分散能力。" },
    { en: "What-If Analysis", zh: "假设分析", domain: "3", desc: "A structured brainstorming technique asking 'what if' to identify hazards and scenarios", descZh: "假设分析是一种结构化的头脑风暴式风险识别方法，通过'如果…会怎样'的提问方式，逐项审视工艺、设备或作业环节可能出现的异常情况及其后果，适合作为PHA的起始步骤。" },
    { en: "Checklist Analysis", zh: "检查表分析", domain: "3", desc: "A risk identification method using a pre-prepared list of potential hazards to verify", descZh: "检查表分析是依据预先编制的检查清单，逐项核对工艺、设备或作业是否符合标准要求、是否存在列出的危害，方法简单高效，适用于常规作业的隐患排查和风险评估。" },

    // Domain 4
    { en: "Emergency Action Plan (EAP)", zh: "应急行动方案", domain: "4", desc: "OSHA 29 CFR 1910.38; required plan covering alarms, evacuation, reporting, and designated responders", descZh: "应急行动方案是OSHA 29 CFR 1910.38要求的书面计划，内容须涵盖报警与通讯程序、疏散路线与程序、事故报告程序、负责协助疏散的指定人员及记录，所有员工须知晓该计划。" },
    { en: "Incident Command System (ICS)", zh: "事故指挥系统", domain: "4", desc: "A standardized, on-scene, all-hazards incident management approach under NIMS", descZh: "事故指挥系统是NIMS（国家事故管理系统）框架下标准化的现场应急管理方法，通过统一的指挥链、模块化的组织结构和统一术语，在各类灾害与大型事件中实现多机构协调响应。" },
    { en: "NFPA 101", zh: "NFPA 101《生命安全规范》", domain: "4", desc: "Life Safety Code — governs occupancy classification, means of egress, and fire protection features", descZh: "NFPA 101《生命安全规范》是美国的生命安全标准，规定了建筑物的占用分类、疏散通道（means of egress）的数量与宽度、消防设施配置和耐火要求，是最常被引用的生命安全与防火规范。" },
    { en: "Means of Egress", zh: "疏散通道", domain: "4", desc: "A continuous path of travel from any point in a building to a public way; exit access → exit → exit discharge", descZh: "疏散通道是从建筑物内任一点通向公共道路的连续疏散路径，由三部分组成：疏散出口通道（exit access）、疏散出口（exit）和出口通向公共区域的通道（exit discharge），其数量、宽度和标识由NFPA 101规定。" },
    { en: "Fire Class A", zh: "A类火灾", domain: "4", desc: "Ordinary combustibles (wood, paper, cloth); extinguished with water or Class A extinguishers", descZh: "A类火灾指普通可燃物（木材、纸张、布料和塑料）火灾，是最常见的一类火灾，可用水、泡沫或ABC干粉灭火器扑灭。" },
    { en: "Fire Class B", zh: "B类火灾", domain: "4", desc: "Flammable liquids and gases; extinguished with CO2, dry chemical, or foam", descZh: "B类火灾指可燃液体和气体火灾，如汽油、溶剂、油漆和丙烷，须使用二氧化碳、干粉或泡沫等灭火剂扑灭，切记不可用水，否则会助长火势蔓延。" },
    { en: "Fire Class C", zh: "C类火灾", domain: "4", desc: "Energized electrical equipment; non-conductive extinguishing agent required", descZh: "C类火灾指带电的电气设备火灾，须使用不导电的灭火剂（如二氧化碳、干粉），扑救时应先尽可能切断电源，使用导电灭火剂（如水）可能导致触电。" },
    { en: "Fire Class D", zh: "D类火灾", domain: "4", desc: "Combustible metals (magnesium, titanium); dry powder extinguishing agents", descZh: "D类火灾指可燃金属火灾（如镁、钛、钠、钾），只能使用专用的金属干粉灭火剂扑灭，使用普通灭火剂或水会加剧燃烧甚至爆炸。" },
    { en: "Fire Class K", zh: "K类火灾", domain: "4", desc: "Cooking oils and fats; wet chemical extinguisher", descZh: "K类火灾指烹饪用植物油和动物油脂火灾，通常发生在商用厨房的油炸设备中，须使用湿化学灭火剂，其通过冷却和皂化油脂形成隔离层来灭火。" },
    { en: "HAZWOPER", zh: "危险废物作业与应急响应", domain: "4", desc: "OSHA 29 CFR 1910.120; hazardous waste operations and emergency response standard", descZh: "危险废物作业与应急响应标准（OSHA 29 CFR 1910.120）规定了危险废物清理、处理、存储、处置设施作业人员及应急响应人员的培训等级、防护要求和健康监护等要求。" },
    { en: "Business Continuity Plan (BCP)", zh: "业务连续性计划", domain: "4", desc: "A plan to ensure critical business functions continue during and after a disruption", descZh: "业务连续性计划是为确保关键业务功能在中断事件（如火灾、自然灾害、IT故障）期间和之后仍能持续运行的预案，涵盖备用场所、数据备份、关键人员接替和恢复时间目标等内容。" },
    { en: "CPTED", zh: "通过环境设计预防犯罪", domain: "4", desc: "Crime Prevention Through Environmental Design — natural surveillance, access control, territorial reinforcement", descZh: "通过环境设计预防犯罪是通过合理设计建筑环境来减少犯罪机会和恐惧感的理念，核心策略包括自然监视、出入口控制、领域强化和维护保养，从而提升场所安全。" },
    { en: "Evacuation Route", zh: "疏散路线", domain: "4", desc: "A designated path from within a building to a safe exit; must be unobstructed and marked", descZh: "疏散路线是建筑物内通向安全出口的预定行走路径，须保持畅通无阻、标识清晰可见并有应急照明，每栋建筑通常须设置至少两条不同方向的疏散路线以备火情阻断。" },
    { en: "Assembly Point", zh: "集合点", domain: "4", desc: "A safe designated outdoor location where evacuees gather after leaving a building", descZh: "集合点是人员在疏散后到建筑物外指定的安全区域集合的地点，通常设在远离建筑的上风向，用于清点人数、确认人员安全并向应急指挥报告，所有员工应事先知晓其位置。" },
    { en: "Fire Alarm", zh: "火灾报警", domain: "4", desc: "A system that detects fire and alerts occupants to evacuate via audible and visual signals", descZh: "火灾报警系统用于在火灾早期发出声音和闪光报警信号，通知楼内人员立即疏散，通常包括手动报警按钮、自动探测器、警铃和联动控制系统等部分，须定期测试和维护。" },
    { en: "Smoke Detector", zh: "烟雾探测器", domain: "4", desc: "A device that senses smoke particles and triggers a fire alarm", descZh: "烟雾探测器是能在火灾初期检测到烟雾颗粒并触发报警的设备，分为离子式（对明火烟雾敏感）和光电式（对阴燃烟雾敏感）两类，须定期测试、清洁，电池须及时更换。" },
    { en: "Sprinkler System", zh: "喷淋系统", domain: "4", desc: "An automatic fire suppression system that discharges water when a heat threshold is reached", descZh: "喷淋系统是建筑物内自动灭火的消防设施，当喷头附近温度达到设定阈值时喷头自动开启喷水灭火，同时联动报警，是保护生命安全和财产最有效的自动灭火措施之一。" },
    { en: "Standpipe", zh: "消防竖管", domain: "4", desc: "A vertical pipe system supplying water for fire hose connections in buildings", descZh: "消防竖管是建筑内为消防水带接口提供加压水源的垂直供水管道系统，分为湿式（常充水）和干式（平时无水、消防车供水后使用），是高层建筑内部灭火的关键设施。" },
    { en: "Fire Extinguisher", zh: "灭火器", domain: "4", desc: "A portable device used to extinguish small fires; class must match the fire type", descZh: "灭火器是可便携移动、用于扑灭初期小火的设备，选用时须匹配火灾类别（如ABC干粉灭火器适用于A、B、C类火灾），并须定期检查压力指示、有效期和维护记录。" },
    { en: "Flashover", zh: "轰燃", domain: "4", desc: "The rapid transition where all combustible surfaces in a room ignite nearly simultaneously", descZh: "轰燃是室内火灾发展到一定阶段时，房间内所有可燃物表面同时达到着火温度、火焰迅速充满整个空间的突变现象，是火灾中导致伤亡最危险的阶段之一，通常在起火后数分钟内发生。" },
    { en: "Backdraft", zh: "回燃", domain: "4", desc: "An explosive reignition of fire gases when oxygen is suddenly introduced to a fire area", descZh: "回燃是缺氧密闭空间内积聚的可燃热解气体在破拆门窗等获得新鲜空气补给时发生的爆炸性复燃现象，消防员破拆前须评估回燃征兆（如冒烟无焰、窗户泛黄）并做好冷却准备。" },
    { en: "Emergency Lighting", zh: "应急照明", domain: "4", desc: "Battery-backed lighting that activates when normal power fails, illuminating egress paths", descZh: "应急照明是主电源中断时自动启用、由蓄电池供电的照明系统，用于保障疏散路线、出口和关键区域的照明，确保人员在火灾、停电等紧急情况下能够安全撤离。" },
    { en: "Medical Emergency", zh: "医疗急救", domain: "4", desc: "A sudden illness or injury requiring immediate medical attention and first aid response", descZh: "医疗急救指突发疾病或伤害需要立即进行急救处理并呼叫专业医疗救助的情形，企业应配备经过急救培训的人员、急救箱和应急预案，并对员工进行心肺复苏和急救技能培训。" },
    { en: "Contingency Plan", zh: "应急计划", domain: "4", desc: "A plan developed for specific emergencies outlining roles, procedures, and resources", descZh: "应急计划是针对可能发生的特定紧急情况（如化学品泄漏、火灾、自然灾害）预先制定的应对预案，明确应急组织分工、处置程序、报警通讯方式和所需资源清单，并定期演练更新。" },
    { en: "Tabletop Exercise", zh: "桌面演练", domain: "4", desc: "A discussion-based exercise where key personnel walk through a simulated emergency scenario", descZh: "桌面演练是一种以讨论为主的应急演练方式，应急人员围坐一起针对模拟的突发事件情景逐环节推演决策和响应流程，不实际调动资源，成本低，用于检验和改进应急计划的完整性与可行性。" },
    { en: "Full-Scale Exercise", zh: "全面演练", domain: "4", desc: "A comprehensive operational exercise involving actual resources, personnel, and on-scene actions", descZh: "全面演练是涉及实际人员、设备、物资和现场行动的综合性实战演练，尽可能模拟真实灾害条件和多方协同场景，用于全面检验应急响应能力、资源调配和各部门间的衔接配合。" },

    // Domain 5
    { en: "GHS", zh: "全球化学品统一分类和标签制度", domain: "5", desc: "Globally Harmonized System for classifying and labeling chemicals; 9 pictograms", descZh: "全球化学品统一分类和标签制度是由联合国制定的化学品分类、标签和安全数据表内容的国际标准，采用9个象形图、信号词和危害说明等统一要素，美国通过HazCom 2012标准在国内实施。" },
    { en: "Safety Data Sheet (SDS)", zh: "安全数据表", domain: "5", desc: "16-section document providing chemical hazard, handling, and emergency information", descZh: "安全数据表是按GHS要求编写的包含16个章节的化学品文件，提供成分识别、危害特性、安全操作与储存、泄漏应急、消防措施、理化性质、毒理和生态信息等内容，是化学品管理和应急处置的重要依据。" },
    { en: "RCRA", zh: "资源保护与回收法", domain: "5", desc: "Resource Conservation and Recovery Act — governs hazardous waste from cradle to grave", descZh: "《资源保护与回收法》是美国管理危险废物'从摇篮到坟墓'全过程的联邦法律，涵盖危险废物的产生、运输、处理、储存和处置各环节，并要求废物产生者进行识别分类、许可和记录报告。" },
    { en: "VSQG", zh: "极小量废物产生者", domain: "5", desc: "Very Small Quantity Generator — ≤100 kg hazardous waste/month", descZh: "极小量废物产生者指每月产生的危险废物不超过100千克（约27加仑）的机构，其管理要求最为宽松，但仍须对危险废物进行正确分类和适当处置。" },
    { en: "SQG", zh: "小量废物产生者", domain: "5", desc: "Small Quantity Generator — 100–1,000 kg hazardous waste/month", descZh: "小量废物产生者指每月产生100至1000千克危险废物的机构，须遵守较严格的储存时限（不得超过180天）、标记和记录要求，并选择合规的运输与处置设施。" },
    { en: "LQG", zh: "大量废物产生者", domain: "5", desc: "Large Quantity Generator — ≥1,000 kg hazardous waste/month", descZh: "大量废物产生者指每月产生超过1000千克危险废物的机构，其管理要求最严格，须取得许可证、遵守90天储存时限、制定应急预案并提交年度报告。" },
    { en: "CERCLA", zh: "《综合环境反应、赔偿与责任法》", domain: "5", desc: "Also known as Superfund; governs hazardous waste site cleanup and liability", descZh: "《综合环境反应、赔偿与责任法》（又称超级基金法）授权EPA对危险废物污染场地进行评估和清理，建立国家优先名录（NPL），并依法向潜在责任方（PRP）追究清理费用和赔偿责任。" },
    { en: "SPCC", zh: "泄漏预防、控制与对策", domain: "5", desc: "Spill Prevention, Control, and Countermeasure — EPA rule for oil storage facilities", descZh: "泄漏预防、控制与对策是EPA针对储油设施制定的规则，规定储油量超过一定规模的设施须制定书面SPCC计划、采取围堰等二次包容措施并配置防泄漏设备，防止油品泄漏进入水体。" },
    { en: "Clean Air Act (CAA)", zh: "《清洁空气法》", domain: "5", desc: "Federal law regulating air emissions; establishes NAAQS and HAPs standards", descZh: "《清洁空气法》是规范大气污染物排放的联邦法律，设立国家环境空气质量标准（NAAQS）对常见污染物进行管控，并针对有害空气污染物（HAPs）设立排放标准，要求工厂取得排放许可。" },
    { en: "Clean Water Act (CWA)", zh: "《清洁水法》", domain: "5", desc: "Federal law regulating pollutant discharges into U.S. waters; NPDES permits", descZh: "《清洁水法》规范向美国水域排放污染物的行为，任何点源排放（如工业废水和雨水排放）须取得NPDES许可证，该法还规定了石油泄漏的责任与处罚，并对水环境质量实施总量控制。" },
    { en: "Hazardous Waste", zh: "危险废物", domain: "5", desc: "Waste that is ignitable, corrosive, reactive, or toxic under RCRA and thus specially regulated", descZh: "危险废物是依据RCRA标准判定具有可燃性、腐蚀性、反应性或毒性的固体废物，其产生、运输、储存和处置均须遵守严格的法规要求，管理不当将承担法律责任。" },
    { en: "Universal Waste", zh: "通用废弃物", domain: "5", desc: "A streamlined RCRA category for batteries, lamps, mercury devices, and pesticides", descZh: "通用废弃物是RCRA中享受简化管理要求的特定危险废物类别，如废电池、荧光灯管、含汞设备和废弃农药，通过简化收集、储存和运输要求以促进其回收利用，减少进入填埋场。" },
    { en: "Reportable Quantity (RQ)", zh: "报告量", domain: "5", desc: "The threshold quantity of a hazardous substance whose release must be immediately reported", descZh: "报告量是法规（如CERCLA）规定的某种危险物质在24小时内一旦泄漏达到该数量，即须立即向国家应急中心和州有关部门报告的门槛值，各物质数值不同，以磅为单位，泄漏超过RQ即触发报告义务。" },
    { en: "National Priorities List", zh: "国家优先名录", domain: "5", desc: "EPA's list of the most serious hazardous waste sites eligible for Superfund cleanup", descZh: "国家优先名录是EPA依据超级基金法列出的最严重污染场地名单，列入NPL的场地可获联邦资金进行长期调查、清理和修复，场地也同时纳入严格的环境监管。" },
    { en: "Potentially Responsible Party", zh: "潜在责任方", domain: "5", desc: "A party liable under CERCLA for cleanup costs at a contaminated site", descZh: "潜在责任方是依超级基金法对污染场地负有清理责任或费用赔偿责任的当事方，包括场地现任与过往所有者、营运者、废物产生者和运输者，EPA可依法向其追偿清理费用。" },
    { en: "NPDES Permit", zh: "国家污染物排放消除系统许可证", domain: "5", desc: "A CWA permit regulating point source discharges into U.S. waters", descZh: "国家污染物排放消除系统许可证是《清洁水法》要求的点源排放许可证，明确排放物的种类、浓度限值、排放总量和监测报告要求，任何向美国水域的工业点源排放均须取得该许可。" },
    { en: "Toxics Release Inventory", zh: "有毒物质排放清单", domain: "5", desc: "EPA's public database of toxic chemical releases reported by facilities under EPCRA", descZh: "有毒物质排放清单是EPA依据《应急计划与社区知情权法》（EPCRA）建立的公开数据库，列出特定行业设施每年向空气、水和土壤排放及转移的有毒化学品种类和数量，并向公众披露。" },
    { en: "Tier II Report", zh: "二级报告", domain: "5", desc: "An annual EPCRA report of hazardous chemicals stored at a facility exceeding thresholds", descZh: "二级报告是依据《应急计划与社区知情权法》要求，企业每年向州应急委员会、地方应急部门（LEPC）和消防部门报告现场储存的超过阈值的特定危险化学品的种类、数量和存放位置，供应急响应使用。" },
    { en: "Secondary Containment", zh: "二次包容", domain: "5", desc: "A dike, berm, or liner system that captures leaks from primary storage containers", descZh: "二次包容是在储罐、桶或管线等主要储存容器之外设置的围堰、堤坝或防渗衬层，其容量通常须达到最大储罐容积的110%，用于在泄漏发生时拦截化学品，防止其扩散进入土壤和水体。" },
    { en: "Best Management Practice", zh: "最佳管理实践", domain: "5", desc: "Practices, procedures, or technologies used to prevent or reduce pollution", descZh: "最佳管理实践是指为减少污染和对环境影响而采用的最佳操作做法与技术措施，常见于雨水管理（如沉淀池、植被缓冲带、覆盖遮挡）和污染预防（如替换物料、工艺优化），是获得排放许可的常见要求。" },
    { en: "Asbestos", zh: "石棉", domain: "5", desc: "A fibrous mineral linked to asbestosis, lung cancer, and mesothelioma; tightly regulated", descZh: "石棉是天然纤维状硅酸盐矿物，曾是广泛使用的耐火、隔热和保温材料，吸入石棉纤维可导致石棉肺、肺癌和间皮瘤，OSHA和EPA对其取样、拆除、处置和暴露限值（PEL为0.1纤维/立方厘米）有严格规定。" },

    // Domain 6
    { en: "Anticipate, Recognize, Evaluate, Control (AREC)", zh: "预判-识别-评估-控制框架", domain: "6", desc: "The four-step framework for occupational exposure assessment", descZh: "预判-识别-评估-控制框架是职业卫生与暴露评估的四步方法：预判（Anticipate）可能的危害、识别（Recognize）实际暴露源与途径、评估（Evaluate）暴露水平并对照限值、制定实施控制（Control）措施。" },
    { en: "Time-Weighted Average (TWA)", zh: "时间加权平均浓度", domain: "6", desc: "TWA = Σ(Ci × Ti) / ΣTi; an 8-hour average exposure", descZh: "时间加权平均浓度是8小时工作日内按时间加权的平均暴露浓度，计算公式为TWA=Σ(Ci×Ti)÷ΣTi，是将各时段浓度按时间加权平均得到的数值，是评价化学物长期职业暴露的主要指标。" },
    { en: "Permissible Exposure Limit (PEL)", zh: "允许暴露限值", domain: "6", desc: "OSHA's legally enforceable exposure limit; 8-hour TWA", descZh: "允许暴露限值是OSHA制定并依法强制执行的暴露限值，以8小时TWA表示，是雇主必须遵守的法律底线，超过PEL即构成违规，须采取工程控制和呼吸防护等纠正措施。" },
    { en: "Threshold Limit Value (TLV)", zh: "阈限值", domain: "6", desc: "ACGIH's recommended occupational exposure limit; updated annually", descZh: "阈限值是ACGIH（美国政府工业卫生师协会）每年更新的推荐职业暴露限值，分为TWA、短时间接触限值（STEL）和上限值（C）三类，属于自愿性指南而非强制标准，但常作为行业基准。" },
    { en: "Recommended Exposure Limit (REL)", zh: "推荐暴露限值", domain: "6", desc: "NIOSH's recommended occupational exposure limit; often most protective", descZh: "推荐暴露限值是NIOSH（美国国家职业安全健康研究所）发布的推荐职业暴露限值，通常比OSHA的PEL更为严格，例如噪声REL为85dBA（3分贝交换率）而OSHA的PEL为90dBA（5分贝交换率）。" },
    { en: "Noise Dose", zh: "噪声剂量", domain: "6", desc: "D = 100 × Σ(Ci/Ti); a dose > 100% indicates overexposure", descZh: "噪声剂量以百分比表示一天内噪声暴露的总量，计算公式为D=100×Σ(Ci/Ti)，其中Ci为实际暴露时长、Ti为该声级下的允许暴露时长，当剂量超过100%时表示超量暴露，须采取措施。" },
    { en: "Decibel (dBA)", zh: "分贝（A计权）", domain: "6", desc: "A-weighted sound level; OSHA PEL = 90 dBA (5-dB exchange), NIOSH REL = 85 dBA (3-dB exchange)", descZh: "A计权分贝是按A加权网络测量的声级，更接近人耳对不同频率声音的敏感度；OSHA的噪声允许暴露限值为90dBA（每增加5分贝暴露时长减半），NIOSH推荐85dBA（3分贝交换率）。" },
    { en: "LD50", zh: "半数致死剂量", domain: "6", desc: "Lethal Dose 50% — the dose that kills 50% of test animals (mg/kg body weight)", descZh: "半数致死剂量是使50%的受试动物死亡的剂量，以每千克体重的毫克数（mg/kg）表示，数值越小表示毒性越大，是化学品急性毒性分级和标签的重要参数。" },
    { en: "LC50", zh: "半数致死浓度", domain: "6", desc: "Lethal Concentration 50% — the airborne concentration that kills 50% of test animals", descZh: "半数致死浓度是使50%的受试动物在吸入暴露后死亡的空气中浓度，以ppm或mg/m³表示，用于评价化学物质通过吸入途径的急性毒性大小。" },
    { en: "Carcinogen", zh: "致癌物", domain: "6", desc: "A substance capable of causing cancer in living tissue", descZh: "致癌物指能够引发癌症的物质，如石棉、苯、甲醛和某些金属，其致癌作用通常具有潜伏期长、剂量-反应关系复杂的特点，IARC和OSHA等机构对其致癌等级和暴露限值有专门分类。" },
    { en: "Teratogen", zh: "致畸物", domain: "6", desc: "A substance that can cause birth defects or developmental abnormalities", descZh: "致畸物指能够导致胎儿出生缺陷或发育异常的物质，如酒精、某些药物、甲基汞和辐射，其危害主要发生在妊娠期的特定敏感阶段，职业场所须对育龄女工进行特别告知与防护。" },
    { en: "NIOSH Lifting Equation", zh: "NIOSH提举方程", domain: "6", desc: "RWL = LC × HM × VM × DM × AM × FM × CM; LI = Actual Load / RWL", descZh: "NIOSH提举方程是评估手工提举任务下背部损伤风险的数学模型，推荐重量限值RWL=常数×水平距离系数×垂直距离系数×移动距离系数×角度系数×频率系数×抓握系数，通过对比实际荷载与RWL判断风险。" },
    { en: "Recommended Weight Limit (RWL)", zh: "建议重量限值", domain: "6", desc: "The maximum recommended weight for a specific lifting task under given conditions", descZh: "建议重量限值是NIOSH提举方程针对特定提举条件（距离、高度、角度、频率和抓握方式）计算出的最大安全提举重量，实际荷载超过RWL即提示需要工程改造或辅助设备。" },
    { en: "Lifting Index (LI)", zh: "提举指数", domain: "6", desc: "LI ≤ 1.0 safe; LI > 1.0 some workers at risk; LI > 3.0 nearly all at risk", descZh: "提举指数是实际荷载与建议重量限值的比值，LI≤1.0表示任务基本安全，LI>1.0表示部分员工存在下背部损伤风险，LI>3.0表示几乎所有员工都处于风险之中，须立即改进。" },
    { en: "Ventilation (Q = VA)", zh: "通风（流量=流速×截面积）", domain: "6", desc: "Q (cfm) = V (fpm) × A (ft²); fundamental ventilation equation", descZh: "通风的基本方程是风量Q（立方英尺/分钟cfm）=风速V（英尺/分钟fpm）×风管截面积A（平方英尺），是计算通风量、设计局部排风和判断通风系统性能的基础公式。" },
    { en: "Local Exhaust Ventilation (LEV)", zh: "局部排风", domain: "6", desc: "Captures contaminants at or near the source before they reach the breathing zone", descZh: "局部排风系统通过在污染源附近设置罩口，在污染物扩散到呼吸区之前将其捕捉并排走，由罩口、风管、空气净化装置和风机组成，是控制空气污染物最有效的工程控制措施之一。" },
    { en: "Inhalation", zh: "吸入", domain: "6", desc: "Entry of a contaminant into the body through the respiratory tract", descZh: "吸入是化学物质进入人体的主要途径之一，污染物（气体、蒸气、气溶胶）经呼吸道进入肺部并被吸收进入血液，在职业暴露中占主导地位，控制重点是通风、隔离和呼吸防护。" },
    { en: "Dermal Absorption", zh: "皮肤吸收", domain: "6", desc: "Entry of a chemical through the skin into the bloodstream", descZh: "皮肤吸收是化学物质经完整皮肤进入体内的暴露途径，如农药、有机溶剂和某些金属（铅、汞），须通过佩戴手套、防护服、避免皮肤接触和良好个人卫生习惯来防护。" },
    { en: "Ingestion", zh: "摄入", domain: "6", desc: "Entry of a contaminant through the mouth into the digestive tract", descZh: "摄入是经口吞入化学物质的暴露途径，多因手口接触、在污染区域进食吸烟或不良卫生习惯引起，虽不如吸入常见，但在铅、砷、镉等物质的暴露评价中不容忽视。" },
    { en: "Acute Exposure", zh: "急性暴露", domain: "6", desc: "A short-term (usually less than 24 hours) exposure to a relatively high concentration", descZh: "急性暴露指在短时间内（通常不超过24小时）发生的一次性或短期较高浓度的暴露，可迅速引发中毒症状，如急性一氧化碳中毒、急性溶剂刺激，其危害取决于剂量和物质毒性。" },
    { en: "Chronic Exposure", zh: "慢性暴露", domain: "6", desc: "Repeated low-level exposure over months or years", descZh: "慢性暴露指在较长时间（数月或数年）内反复进行的低浓度暴露，如长期接触噪声、粉尘或石棉，其健康损害（如听力损失、矽肺、癌症）通常在多年之后才逐渐显现。" },
    { en: "Dose-Response", zh: "剂量-反应关系", domain: "6", desc: "The quantitative relationship between exposure dose and the severity of biological response", descZh: "剂量-反应关系是毒理学的基本原理，描述暴露剂量与生物体反应的严重程度或发生率之间的定量关系，通常随剂量增大反应加剧，是制定职业暴露限值（如PEL、TLV）的理论基础。" },
    { en: "Mutagen", zh: "致突变物", domain: "6", desc: "A substance that causes changes (mutations) in the genetic material of cells", descZh: "致突变物指能够改变细胞遗传物质（DNA）从而引起基因突变的物质，如苯、环氧乙烷和电离辐射，许多致突变物同时也是致癌物，涉及生殖健康和遗传风险，需严格控制暴露。" },
    { en: "WBGT", zh: "湿球黑球温度", domain: "6", desc: "Wet Bulb Globe Temperature — a heat stress index combining humidity, air temperature, and radiant heat", descZh: "湿球黑球温度是综合湿球温度（湿度）、黑球温度（辐射热）和干球温度（空气温度）计算的热环境指标，用于评价热应激，ACGIH按WBGT值和工作负荷强度划分热暴露限值并规定相应休息比例。" },
    { en: "Heat Stress", zh: "热应激", domain: "6", desc: "The heat load on the body exceeding its ability to dissipate heat, causing heat illness", descZh: "热应激是机体在高温环境下散热负荷超过自身调节能力的状态，可引发热疹、热痉挛、热衰竭和中暑等热相关疾病，控制措施包括补水、工间休息、轮换作业、遮阳和降温设备。" },
    { en: "Combustible Dust", zh: "可燃粉尘", domain: "6", desc: "Fine combustible particles suspended in air that can explode when ignited in a confined space", descZh: "可燃粉尘是悬浮在空气中的可燃性细颗粒物（如面粉、糖、金属粉末、木材和煤粉尘），在密闭空间内浓度达到爆炸下限并遇到点火源时可发生剧烈粉尘爆炸，须通过通风除尘、防爆设备和清理积尘来控制。" },
    { en: "Silica", zh: "二氧化硅", domain: "6", desc: "Crystalline silica dust causes silicosis; OSHA PEL tightened to 50 µg/m³", descZh: "二氧化硅是地壳中最常见的矿物，切割混凝土、石材、喷砂等作业产生的结晶型二氧化硅粉尘吸入后可导致矽肺、肺癌和慢性阻塞性肺病，OSHA将呼吸性结晶硅PEL定为50微克/立方米并强调湿法作业等工程控制。" },

    // Domain 7
    { en: "ADDIE Model", zh: "ADDIE模型", domain: "7", desc: "Analysis → Design → Development → Implementation → Evaluation; a systematic instructional design framework", descZh: "ADDIE模型是系统化教学设计框架，包括分析（Analysis）、设计（Design）、开发（Development）、实施（Implementation）和评估（Evaluation）五个阶段，是开发培训课程和教学材料的经典流程。" },
    { en: "Andragogy", zh: "成人教育学", domain: "7", desc: "Knowles's theory of adult learning; adults are self-directed, experience-based, problem-centered learners", descZh: "成人教育学是诺尔斯（Knowles）提出的成人学习理论，认为成人是自我导向、以已有经验为基础、以问题和实际需要为中心的学习者，其学习动机更多来自内部而非外部压力。" },
    { en: "VARK", zh: "VARK学习风格", domain: "7", desc: "Visual, Auditory, Reading/Writing, Kinesthetic — four learning style modalities", descZh: "VARK是描述学习者信息接收偏好的四种学习风格模态：视觉型（Visual）、听觉型（Auditory）、读写型（Reading/Writing）和动觉型（Kinesthetic），培训设计可据此采用多样化的教学手段。" },
    { en: "Kirkpatrick Model", zh: "柯氏四级评估模型", domain: "7", desc: "Four levels of training evaluation: Reaction → Learning → Behavior → Results", descZh: "柯氏四级评估模型用于评价培训效果，分为反应（Reaction，学员满意度）、学习（Learning，知识与技能掌握）、行为（Behavior，工作行为改变）和结果（Results，组织绩效提升）四个递进层次。" },
    { en: "Needs Assessment", zh: "需求评估", domain: "7", desc: "A systematic process to identify training gaps before developing a program", descZh: "需求评估是培训开发的第一步，通过分析组织目标、工作任务要求和员工现有能力之间的差距，确定是否存在培训需求、培训的具体内容以及最合适的培训对象与方式。" },
    { en: "Learning Objectives", zh: "学习目标", domain: "7", desc: "Specific, measurable statements of what learners should be able to do after training", descZh: "学习目标是描述受训者经过培训后应能完成的具体行为或能力的陈述，通常按ABCD法（对象、行为、条件、标准）编写，要求具体、可测量、可观察，是设计培训内容和评估的依据。" },
    { en: "Bloom's Taxonomy", zh: "布鲁姆分类法", domain: "7", desc: "A hierarchy of cognitive learning levels: remember, understand, apply, analyze, evaluate, create", descZh: "布鲁姆分类法将认知领域的学习目标由低到高分为记忆、理解、应用、分析、评价和创造六个层次，用于设计递进式的学习目标和与之匹配的评估方式。" },
    { en: "On-the-Job Training", zh: "在岗培训", domain: "7", desc: "Training conducted in the actual workplace while performing the job, often with a coach", descZh: "在岗培训是在实际工作岗位上通过示范、观察和操作练习进行的培训方式，其优点是贴近真实工作场景、成本较低、技能转化快，但须有合格的指导者和结构化的培训计划。" },
    { en: "Simulation", zh: "模拟训练", domain: "7", desc: "Training using simulated equipment, environments, or scenarios to practice skills safely", descZh: "模拟训练是通过模拟真实环境或设备（如操作仿真器、虚拟现实、应急桌面演练和角色扮演）进行训练的方式，允许学员在无实际风险条件下反复练习和纠错，适用于高危险或高成本技能。" },
    { en: "Toolbox Talk", zh: "工具箱谈话", domain: "7", desc: "A short, informal safety meeting conducted at the job site before work begins", descZh: "工具箱谈话是在作业现场利用开工前进行的简短（通常5-10分钟）非正式安全培训，围绕一个具体的安全主题（如当天的作业风险、PPE佩戴）展开讨论，用于强化员工安全意识和提醒风险。" },
    { en: "Continuous Improvement", zh: "持续改进", domain: "7", desc: "The ongoing effort to improve products, services, or processes through incremental changes", descZh: "持续改进是PDCA（策划-实施-检查-处置）循环所体现的管理理念，强调通过不断评估培训效果、收集反馈并优化培训内容与方式，使员工能力和安全绩效得到持续提升。" },
    { en: "Competency", zh: "胜任力", domain: "7", desc: "The combination of knowledge, skills, and attitudes needed to perform a task effectively", descZh: "胜任力是个体有效完成特定工作任务所需的知识、技能和态度的综合能力，培训的目标即在于建立并验证员工达到规定的胜任力标准，通常通过考核、认证和现场实操来评价。" },
    { en: "Evaluation", zh: "评估", domain: "7", desc: "The process of judging training effectiveness against learning objectives and organizational goals", descZh: "评估是依据学习目标和培训数据，系统判断培训是否达到预期效果的过程，常用柯氏四级模型从反应、学习、行为和结果四个层次进行，其结果用于改进后续培训项目。" }
  ];

  // ============ VOCABULARY MANAGER ============
  function loadVocab() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_VOCAB)) || []; }
    catch(e) { return []; }
  }
  function saveVocab(list) {
    localStorage.setItem(STORAGE_KEY_VOCAB, JSON.stringify(list));
  }

  window.CSPVocab = {
    // Get full glossary
    getGlossary: function() { return GLOSSARY; },

    // Get glossary filtered by domain
    getGlossaryByDomain: function(domainId) {
      return GLOSSARY.filter(g => g.domain === String(domainId));
    },

    // Search glossary
    searchGlossary: function(query) {
      const q = query.toLowerCase();
      return GLOSSARY.filter(g =>
        g.en.toLowerCase().includes(q) ||
        g.zh.includes(q) ||
        g.desc.toLowerCase().includes(q)
      );
    },

    // Saved words
    getSavedWords: function() { return loadVocab(); },

    isSaved: function(termEn) {
      return loadVocab().some(v => v.en === termEn);
    },

    toggleSave: function(termEn) {
      const list = loadVocab();
      const idx = list.findIndex(v => v.en === termEn);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        const term = GLOSSARY.find(g => g.en === termEn);
        if (term) list.push({ ...term, savedAt: new Date().toISOString() });
      }
      saveVocab(list);
      this.refreshWidget();
      return list;
    },

    saveTerm: function(termEn) {
      const list = loadVocab();
      if (!list.find(v => v.en === termEn)) {
        const term = GLOSSARY.find(g => g.en === termEn);
        if (term) list.push({ ...term, savedAt: new Date().toISOString() });
        saveVocab(list);
      }
      this.refreshWidget();
      return list;
    },

    removeTerm: function(termEn) {
      const list = loadVocab().filter(v => v.en !== termEn);
      saveVocab(list);
      this.refreshWidget();
      return list;
    },

    // Refresh floating widget count
    refreshWidget: function() {
      const count = loadVocab().length;
      const badge = document.getElementById('vw-badge');
      if (badge) badge.textContent = count;
      const popupList = document.getElementById('vw-popup-list');
      if (popupList) this.renderPopupList(popupList);
    },

    renderPopupList: function(el) {
      const list = loadVocab();
      if (list.length === 0) {
        el.innerHTML = '<p style="color:var(--text-secondary);font-size:0.85rem;">No saved words yet. Click ★ on any term to add it.</p>';
        return;
      }
      let html = '';
      for (const v of list) {
        html += '<div class="vw-item">';
        html += '<div><strong style="color:var(--accent);">' + escapeHtml(v.en) + '</strong><br><span style="color:var(--text-secondary);">' + escapeHtml(v.zh) + '</span></div>';
        html += '<button class="remove-btn" onclick="CSPVocab.removeTerm(\'' + escapeAttr(v.en) + '\')" title="Remove">✕</button>';
        html += '</div>';
      }
      el.innerHTML = html;
    },

    // Initialize the floating vocab widget
    initWidget: function() {
      // Only create if not already present
      if (document.getElementById('vocab-widget')) return;

      const widget = document.createElement('div');
      widget.id = 'vocab-widget';
      widget.className = 'vocab-widget';
      const count = loadVocab().length;
      widget.innerHTML = '' +
        '<button class="vw-toggle" onclick="document.getElementById(\'vocab-popup\').classList.toggle(\'show\')" title="Vocabulary Book">📖</button>' +
        '<span class="vw-count" id="vw-badge">' + count + '</span>';

      const popup = document.createElement('div');
      popup.id = 'vocab-popup';
      popup.className = 'vocab-popup';
      popup.innerHTML = '' +
        '<h3>📖 My Vocabulary Book <a href="glossary.html" style="font-size:0.8rem;float:right;">Full Glossary →</a></h3>' +
        '<div id="vw-popup-list"></div>' +
        '<div style="margin-top:12px;text-align:center;">' +
        '<a href="vocab-flashcards.html" class="btn btn-primary" style="text-decoration:none;font-size:0.82rem;">🎴 Flashcards</a>' +
        '</div>';

      document.body.appendChild(widget);
      document.body.appendChild(popup);
      this.refreshWidget();
    },

    // Bind inline term clicks
    bindTermClick: function(el) {
      el.addEventListener('click', function(e) {
        // If user clicked the star, handle save
        const star = e.target.closest('.vocab-star');
        if (star) {
          e.stopPropagation();
          const termEn = star.getAttribute('data-term');
          if (CSPVocab.isSaved(termEn)) {
            CSPVocab.removeTerm(termEn);
          } else {
            CSPVocab.saveTerm(termEn);
          }
          // Update all stars for this term
          document.querySelectorAll('.vocab-star[data-term="' + escapeAttr(termEn) + '"]').forEach(s => {
            s.textContent = CSPVocab.isSaved(termEn) ? '★' : '☆';
            if (CSPVocab.isSaved(termEn)) s.classList.add('saved');
            else s.classList.remove('saved');
          });
          return;
        }
        // Otherwise, show the definition popup
        const termEl = e.target.closest('[data-vocab-term]');
        if (termEl) {
          const termEn = termEl.getAttribute('data-vocab-term');
          CSPVocab.showDefinition(termEn, e);
        }
      });
    },

    // ===== Click-to-define popup =====
    showDefinition: function(termEn, event) {
      // Close existing popup
      this.closeDefinition();

      const term = GLOSSARY.find(g => g.en.toLowerCase() === termEn.toLowerCase());
      if (!term) return;

      const isSaved = this.isSaved(term.en);
      const domainName = DOMAIN_NAMES[term.domain] || ('Domain ' + term.domain);

      const pop = document.createElement('div');
      pop.id = 'vocab-def-popup';
      pop.className = 'vocab-def-popup';
      pop.innerHTML = '' +
        '<div class="vdp-head">' +
          '<span class="vdp-en">' + escapeHtml(term.en) + '</span>' +
          '<button class="vdp-close" onclick="CSPVocab.closeDefinition()">✕</button>' +
        '</div>' +
        '<div class="vdp-zh">' + escapeHtml(term.zh) + '</div>' +
        '<div class="vdp-domain">' + domainName + '</div>' +
        '<div class="vdp-desc">' + escapeHtml(term.desc || '') + '</div>' +
        '<div class="vdp-desc-zh">' + escapeHtml(term.descZh || term.zhDesc || term.desc || '') + '</div>' +
        '<button class="btn ' + (isSaved ? 'btn-outline' : 'btn-primary') + '" id="vdp-save-btn" ' +
          'onclick="CSPVocab.toggleSaveFromPopup(\'' + escapeAttr(term.en) + '\')">' +
          (isSaved ? '★ 已在词库 / In vocab' : '☆ 加入词库 / Add to vocab') +
        '</button>';

      // Position near click
      document.body.appendChild(pop);
      if (event && event.pageX) {
        const x = Math.min(event.pageX, window.innerWidth - pop.offsetWidth - 20);
        const y = Math.min(event.pageY, window.innerHeight - pop.offsetHeight - 20);
        pop.style.left = x + 'px';
        pop.style.top = y + 'px';
      } else {
        pop.style.left = '50%';
        pop.style.top = '50%';
        pop.style.transform = 'translate(-50%, -50%)';
      }
      pop.classList.add('show');

      // Click outside to close
      setTimeout(() => {
        document.addEventListener('click', function(e) {
          if (!pop.contains(e.target)) {
            CSPVocab.closeDefinition();
          }
        }, { once: true });
      }, 50);
    },

    toggleSaveFromPopup: function(termEn) {
      if (this.isSaved(termEn)) {
        this.removeTerm(termEn);
      } else {
        this.saveTerm(termEn);
      }
      const btn = document.getElementById('vdp-save-btn');
      if (btn) {
        const isSaved = this.isSaved(termEn);
        btn.textContent = isSaved ? '★ 已在词库 / In vocab' : '☆ 加入词库 / Add to vocab';
        btn.className = 'btn ' + (isSaved ? 'btn-outline' : 'btn-primary');
      }
    },

    closeDefinition: function() {
      const pop = document.getElementById('vocab-def-popup');
      if (pop) pop.remove();
    },

    // ===== Auto-highlight glossary terms in page content =====
    autoHighlight: function() {
      // Only highlight terms that match words in knowledge-card content
      const cards = document.querySelectorAll('.knowledge-card p, .knowledge-card li, .knowledge-card td, .knowledge-card h3');
      cards.forEach(el => {
        if (el.querySelector('.bi-term')) return; // already has bilingual spans
        const text = el.innerHTML;
        if (!text || text.length < 10) return;

        // Find glossary terms in this element's text
        let modified = false;
        let newText = text;
        for (const term of GLOSSARY) {
          // Skip very short or generic terms to avoid false matches
          if (term.en.length < 4) continue;
          // Case-insensitive word-boundary match
          const re = new RegExp('\\b(' + escapeRegExp(term.en) + ')\\b', 'i');
          if (re.test(newText) && !newText.includes('data-vocab-term="' + escapeAttr(term.en) + '"')) {
            // Wrap first occurrence (or all) in clickable span
            newText = newText.replace(re, function(m) {
              return '<span class="vocab-inline" data-vocab-term="' + escapeAttr(term.en) + '" title="' + escapeAttr(term.zh) + '">' + m + '</span>';
            });
            modified = true;
          }
        }
        if (modified) el.innerHTML = newText;
      });

      // Bind clicks on newly highlighted terms
      document.querySelectorAll('.vocab-inline[data-vocab-term]').forEach(el => {
        if (!el.getAttribute('data-bound')) {
          el.setAttribute('data-bound', 'true');
          el.addEventListener('click', function(e) {
            const termEn = this.getAttribute('data-vocab-term');
            CSPVocab.showDefinition(termEn, e);
          });
        }
      });
    }
  };

  const DOMAIN_NAMES = {
    '1': 'Domain 1: 安全原理高级应用 / Advanced Application of Safety Principles',
    '2': 'Domain 2: 项目管理 / Program Management',
    '3': 'Domain 3: 风险管理 / Risk Management',
    '4': 'Domain 4: 应急管理 / Emergency Management',
    '5': 'Domain 5: 环境管理 / Environmental Management',
    '6': 'Domain 6: 职业健康与应用科学 / Occupational Health & Applied Science',
    '7': 'Domain 7: 培训 / Training'
  };

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ============ AUTO-INIT ============
  // Initialize widget on every page load
  document.addEventListener('DOMContentLoaded', function() {
    CSPVocab.initWidget();

    // Bind click events on all bi-term elements
    document.querySelectorAll('.bi-term').forEach(el => {
      CSPVocab.bindTermClick(el);
    });

    // Auto-highlight glossary terms in knowledge content
    setTimeout(() => {
      CSPVocab.autoHighlight();
    }, 100);
  });

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function escapeAttr(s) { return s.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

  console.log('📖 CSP Vocabulary Engine loaded. ' + GLOSSARY.length + ' terms in glossary.');
})();
