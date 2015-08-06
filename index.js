d3.egoNetworks = function module() {
  var attrs = {
    width: 400,
    height:400,
    egoIndex:0,
    degreeMin:1,
    degreeMax:10
  }
  var margin = {top:10, right:10, bottom:10, left:10}
  var size = d3.scale.linear();
  var innerWidth, innerHeight, netRadius;
  var svg;

  var exports = function (_selection) {
    _selection.each(function(_data) {
      if(!svg) {
        d3.select(this).style('width', attrs.width + 'px')
          .style('height', attrs.height + 'px')
        innerWidth = attrs.width - margin.left - margin.right;
        innerHeight = attrs.height - margin.top - margin.bottom;
        netRadius = innerWidth*.4;
        svg = d3.select(this).append('svg')
          .attr('width', attrs.width)
          .attr('height', attrs.height)
          .append('g')
          .attr('transform', d3.svg.transform().translate([margin.left, margin.top]))
      }
      size.domain([attrs.degreeMin,attrs.degreeMax])
        .rangeRound([innerWidth*.04, innerWidth*.25]);
      svg.datum(_data)
        .call(egoInit)
    })
  }

  function egoInit(_selection) {
    _selection.each(function(_data) {
      var egoData = getCurEgo(_data.nodes), neighborsData = getNeighbors(_data);
      egoData.egoIndex = attrs.egoIndex;
      egoData.egoDegree = neighborsData.reduce(function(pre, cur){
        return pre + cur.linkToEgo.value
      },0)
      //setLinkToNeighbors(neighborsData, _data.links)

      var thetaUnit = Math.PI*2 / neighborsData.length, thetaOffset = thetaUnit *.2;
      d3.select(this).append('circle')
        .attr('class', 'background')
        .attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
        .attr('r', netRadius)


      var ego = d3.select(this).selectAll('.ego')
        .data([egoData], function(d){return attrs.egoIndex})

      ego.enter().append('g')
        .attr('class', 'ego node')
        .append('circle')

      ego.attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
        .selectAll('circle')
        .attr('r', function(d){return size(d.egoDegree)})

      ego.exit()
        .classed({'ego':false, 'neighbor':true})

      var neighbors = d3.select(this).selectAll('.neighbor')
        .data(neighborsData, function(d){return d.neighborIndex})

      neighbors.enter().append('g')
        .attr('class', 'neighbor node new')

      d3.select(this).selectAll('.neighbor.new')
        .append('circle')
      d3.select(this).selectAll('.neighbor.new')
        .append('text')
      d3.select(this).selectAll('.neighbor.new')
        .classed({'new':false})

      neighbors.each(function(d,i) {
        d.theta = thetaUnit*i;
        d.linkToNeighbors = []
        neighbors.each(function(n,j) {
          if (j>i) {
            var filtered = _data.links.filter(function(l) {
              return (l.source === d.neighborIndex && l.target === n.neighborIndex)
                || (l.target === d.neighborIndex && l.source === n.neighborIndex)
            })
            d.linkToNeighbors = d.linkToNeighbors.concat(filtered); // 한쪽에만 링크를 두어서 루프 최소화
          }
        })
        }).attr('transform', d3.svg.transform().translate(function(d,i) {
          if ('linkToNeighbors' in d) {
            d.linkToNeighbors.forEach(function(l) {
              neighbors.filter(function(n) {
                return ((l.source == n.neighborIndex || l.target == n.neighborIndex)
                  && n.neighborIndex !== d.neighborIndex)
              }).each(function(n) {
                  if(n.theta - d.theta <= Math.PI) {
                    d.theta += thetaOffset;
                    n.theta -= thetaOffset;
                  } else {
                    d.theta -= thetaOffset;
                    n.theta += thetaOffset;
                  }
              })
            })
          }
          return [innerWidth*.5+Math.cos(d.theta)*netRadius, innerHeight*.5+Math.sin(d.theta)*netRadius]
        }))

      neighbors.selectAll('circle')
        .attr('r', function(d){return size(d.linkToEgo.value)})

      neighbors.selectAll('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .text(function(d) {return d.neighborIndex})
      /*
      ego.attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeigh/2]))
        .attr('r', )
      */

      /*
      TODO
        [x] 1. neighbors 구하기
        2. ego의 degree 값 구하기
        3. neighbor들을 그룹 key 가 있다면 함께 묶어주기 => nested
        3. ego와 neighbor 그리기 (절대값은?)
        4. (옵션) distant 2 까지 그리기?
        5. (옵션) 연도와 같이 정렬이나 분류 가능한 기준이 있다면 해당 값에 따라 ego와의 거리를 조절?
        5. 이웃 node 클릭시 새롭게 이동? -> 1로 다시
      */
    })
  }

  function getNeighbors(_data) {
    var neighbors = []
    _data.links.forEach(function(l,i) {
      if (attrs.egoIndex === l.source) {
        neighbors.push({neighbor:_data.nodes[l.target], linkToEgo:l, neighborIndex:l.target})
      } else if (attrs.egoIndex === l.target) {
        neighbors.push({neighbor:_data.nodes[l.source], linkToEgo:l, neighborIndex:l.source})
      }
    })
    return neighbors;
  }

  function getCurEgo(nodes) {
    return nodes[attrs.egoIndex]
  }

  function accessor(_attr) {
    return function(value) {
      if(value === undefined) return attrs[_attr]
      attrs[_attr] = value;
      return exports;
    }
  }

  for (var attr in attrs) {
    if(attrs.hasOwnProperty(attr)) {
      exports[attr] = accessor(attr);
    }
  }

  return exports;
}
